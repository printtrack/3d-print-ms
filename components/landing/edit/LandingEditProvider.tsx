"use client";

// The whole editing surface now lives inside the preview, next to the thing it
// edits. This provider is its brain.
//
// It replaces the old parent↔iframe postMessage bridge outright: the preview is
// same-origin and carries the session, so it calls the API itself. The admin
// page around it is a header and nothing more.
//
// Rendered only in edit mode (app/page.tsx gates that on the landing.edit
// permission), so none of this reaches a visitor.
//
// Server components render the block markup; the small client leaves inside them
// (BlockToolbar, IconEditor, …) reach this through context. That works because
// the server-rendered blocks are `children` of this provider — one React tree at
// runtime, whatever rendered each node.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { BlockType } from "@/lib/landing/blocks";
import type { Locale } from "@/i18n/locale";

const AUTOSAVE_MS = 1000;
const SCROLL_KEY = "landing-edit-scroll";

export interface EditableBlock {
  id: string;
  type: string;
  position: number;
  visible: boolean;
  data: unknown;
}

interface LandingEditValue {
  locale: Locale;
  blocks: EditableBlock[];
  /** Copy for the edit chrome, handed down from the server (next-intl lives there). */
  labels: Record<string, string>;
  /**
   * A block's data as of the last commit, for handlers computing a patch. Not
   * reactive — render from `blocks` (or useBlockData) instead.
   */
  data: (blockId: string) => Record<string, unknown>;
  /**
   * Replace a block's data. Debounced.
   *
   * `reload` decides whether the page is re-rendered by the server afterwards.
   * Pass true when the change alters markup this client cannot reproduce (an
   * image, a background, a markdown body). Pass false when it does not — an alt
   * text, a link target, or anything a client component draws itself — because
   * reloading on every keystroke closes the popover you are typing in.
   */
  update: (blockId: string, data: unknown, reload?: boolean) => void;
  /** Re-render from the server now, keeping the scroll position. */
  refresh: () => void;
  /**
   * Change one string. The workhorse behind inline text editing.
   * `plain` writes the value directly instead of into the {de,en} pair — see
   * Editable's `plain` prop.
   */
  setText: (
    blockId: string,
    field: string,
    index: number | undefined,
    value: string,
    plain?: boolean,
  ) => void;
  addBlock: (type: BlockType, afterBlockId?: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  toggleVisible: (blockId: string) => Promise<void>;
  moveBlock: (blockId: string, direction: -1 | 1) => Promise<void>;
  busy: boolean;
}

const Ctx = createContext<LandingEditValue | null>(null);

/** Null outside edit mode — every edit component checks and renders nothing. */
export function useLandingEdit(): LandingEditValue | null {
  return useContext(Ctx);
}

/**
 * A block's data, reactive. For edit components that draw their own element and
 * must show a change immediately, without waiting for a server round-trip.
 */
export function useBlockData(blockId: string): Record<string, unknown> {
  const edit = useContext(Ctx);
  return (edit?.blocks.find((b) => b.id === blockId)?.data ?? {}) as Record<string, unknown>;
}

/**
 * Apply one localized-string edit.
 *
 * `field` is the path the renderer tagged the element with:
 *   "headline1"            → data.headline1[locale]
 *   "items.title" + index  → data.items[index].title[locale]
 */
function applyText(
  data: Record<string, unknown>,
  field: string,
  index: number | undefined,
  locale: Locale,
  value: string,
  plain: boolean,
): Record<string, unknown> {
  const next = { ...data };
  // A localized field is a {de,en} pair to merge into; a plain one is the string
  // itself (the step numerals).
  const merge = (current: unknown): unknown =>
    plain ? value : { ...((current ?? {}) as Record<string, string>), [locale]: value };

  if (index === undefined) {
    next[field] = merge(next[field]);
    return next;
  }

  const [arrayKey, prop] = field.split(".");
  // An indexed field is always "array.prop"; anything else means a renderer and
  // this function have drifted apart. Leave the data alone rather than writing
  // a key called "undefined" into it.
  if (!prop) return data;
  const items = [...((next[arrayKey] as Record<string, unknown>[]) ?? [])];
  const item = items[index];
  if (!item) return data;
  items[index] = { ...item, [prop]: merge(item[prop]) };
  next[arrayKey] = items;
  return next;
}

export function LandingEditProvider({
  initialBlocks,
  locale,
  labels,
  children,
}: {
  initialBlocks: EditableBlock[];
  locale: Locale;
  labels: Record<string, string>;
  children: ReactNode;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busy, setBusy] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ id: string; data: unknown; reload: boolean } | null>(null);

  const fail = useCallback(
    (err: unknown) => toast.error(err instanceof Error ? err.message : labels.saveFailed),
    [labels.saveFailed],
  );

  /**
   * Re-render the page from the server, keeping the reader where they were.
   *
   * Structural edits (a new icon, another block, a different order) change
   * markup this client cannot reproduce faithfully — the blocks are server
   * components. Reloading always shows the real page; the scroll stash is what
   * stops that from feeling like a reset.
   */
  const reloadPreservingScroll = useCallback(() => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.location.reload();
  }, []);

  /**
   * Tell the admin frame the draft now differs from what is public, so its
   * "Publish" button lights up. One-way ping — the frame owns publish/discard;
   * this is the only thing the preview reports upward. Origin-pinned.
   */
  const notifyDirty = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "landing-dirty" }, window.location.origin);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved === null) return;
    sessionStorage.removeItem(SCROLL_KEY);
    window.scrollTo(0, Number(saved));
  }, []);

  /** Write the pending edit now, cancelling its timer. Safe to call spuriously. */
  const flush = useCallback(async () => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/landing/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: job.data }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? labels.saveFailed);
      }
      notifyDirty();
      if (job.reload) reloadPreservingScroll();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }, [fail, labels.saveFailed, reloadPreservingScroll, notifyDirty]);

  const flushRef = useRef(flush);
  const blocksRef = useRef(blocks);
  useEffect(() => {
    flushRef.current = flush;
    blocksRef.current = blocks;
  });

  // Leaving must not eat the last second of typing.
  useEffect(() => () => void flushRef.current(), []);

  const queueSave = useCallback(
    (id: string, data: unknown, reload: boolean) => {
      // A pending edit to a *different* block must go out now, or the new timer
      // would replace it and that change would only ever exist in local state.
      if (pending.current && pending.current.id !== id) void flushRef.current();
      pending.current = { id, data, reload };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
    },
    [],
  );

  const data = useCallback(
    (blockId: string) =>
      (blocksRef.current.find((b) => b.id === blockId)?.data ?? {}) as Record<string, unknown>,
    [],
  );

  const update = useCallback(
    (blockId: string, next: unknown, reload = true) => {
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, data: next } : b)));
      queueSave(blockId, next, reload);
    },
    [queueSave],
  );

  const setText = useCallback(
    (blockId: string, field: string, index: number | undefined, value: string, plain = false) => {
      const block = blocksRef.current.find((b) => b.id === blockId);
      if (!block) return;
      const next = applyText(
        block.data as Record<string, unknown>,
        field,
        index,
        locale,
        value,
        plain,
      );
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, data: next } : b)));
      // reload: false — the DOM already shows this text; reloading would yank the
      // cursor out mid-word.
      queueSave(blockId, next, false);
    },
    [locale, queueSave],
  );

  /** Structural change: settle any pending text edit first, then act, then re-render. */
  const structural = useCallback(
    async (run: () => Promise<Response>, dropPendingFor?: string) => {
      if (dropPendingFor && pending.current?.id === dropPendingFor) {
        pending.current = null;
        if (saveTimer.current) clearTimeout(saveTimer.current);
      } else {
        await flushRef.current();
      }

      setBusy(true);
      try {
        const res = await run();
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? labels.saveFailed);
        }
        notifyDirty();
        reloadPreservingScroll();
      } catch (err) {
        fail(err);
        setBusy(false);
      }
      // No setBusy(false) on success: the reload takes the page away anyway, and
      // clearing it would flash the controls back to life first.
    },
    [fail, labels.saveFailed, reloadPreservingScroll, notifyDirty],
  );

  const addBlock = useCallback(
    async (type: BlockType, afterBlockId?: string) => {
      await structural(() =>
        fetch("/api/admin/landing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, afterBlockId }),
        }),
      );
    },
    [structural],
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      await structural(
        () => fetch(`/api/admin/landing/${blockId}`, { method: "DELETE" }),
        blockId,
      );
    },
    [structural],
  );

  const toggleVisible = useCallback(
    async (blockId: string) => {
      const block = blocksRef.current.find((b) => b.id === blockId);
      if (!block) return;
      await structural(() =>
        fetch(`/api/admin/landing/${blockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visible: !block.visible }),
        }),
      );
    },
    [structural],
  );

  const moveBlock = useCallback(
    async (blockId: string, direction: -1 | 1) => {
      const ordered = [...blocksRef.current].sort((a, b) => a.position - b.position);
      const from = ordered.findIndex((b) => b.id === blockId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ordered.length) return;
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);

      await structural(() =>
        fetch("/api/admin/landing/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockIds: ordered.map((b) => b.id) }),
        }),
      );
    },
    [structural],
  );

  return (
    <Ctx.Provider
      value={{
        locale,
        blocks,
        labels,
        data,
        update,
        refresh: reloadPreservingScroll,
        setText,
        addBlock,
        deleteBlock,
        toggleVisible,
        moveBlock,
        busy,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
