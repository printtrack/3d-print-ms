"use client";

// Removing an entry, and adding one.
//
// Two pieces on purpose. A plus hovering over *every* card was noise — one add
// affordance per list reads far better. So `ItemToolbar` is now just the remove
// button, per entry (you delete a specific one); `AddItemTile` is a single
// dashed placeholder at the end of the list that appends a new entry.
//
// The shape of a fresh entry is NOT passed in: a server component cannot hand a
// function to a client one, and duplicating the shape here would be a second
// source of truth. It comes from the registry, which already says what a new
// block of this type looks like — its first item is a new item.
//
// Both add and remove change the server-rendered markup, so both reload.

import { Plus, Trash2 } from "lucide-react";
import { blockDef, isBlockType } from "@/lib/landing/blocks";
import { useLandingEdit } from "./LandingEditProvider";

/** A blank entry for this block type, taken from the registry's defaults. */
function freshItem(blockType: string, position: number): Record<string, unknown> | null {
  if (!isBlockType(blockType)) return null;
  const defaults = blockDef(blockType).defaults() as { items?: Record<string, unknown>[] };
  const template = defaults.items?.[0];
  if (!template) return null;

  const item: Record<string, unknown> = structuredClone(template);
  // Blank out the copy — the template carries example text meant for a brand new
  // block, not for one more row in an existing list.
  for (const [key, value] of Object.entries(item)) {
    if (value && typeof value === "object" && "de" in (value as object)) {
      item[key] = { de: "", en: "" };
    }
  }
  // The steps block numbers its entries; a copy of the first would read "01".
  if (typeof item.number === "string") item.number = String(position + 1).padStart(2, "0");
  return item;
}

/** The per-entry remove control. */
export function ItemToolbar({
  blockId,
  index,
  min,
}: {
  blockId: string;
  index: number;
  /** Below this the block stops making sense (a features block with no features). */
  min: number;
}) {
  const edit = useLandingEdit();
  if (!edit) return null;

  const items = (edit.data(blockId).items as Record<string, unknown>[]) ?? [];

  return (
    <div className="landing-edit-chrome absolute -top-3 right-2 z-30 rounded-lg border border-border bg-popover/95 p-0.5 shadow-sm backdrop-blur">
      <button
        type="button"
        aria-label={edit.labels.removeItem}
        title={edit.labels.removeItem}
        disabled={items.length <= min || edit.busy}
        onClick={() => edit.update(blockId, { ...edit.data(blockId), items: items.filter((_, i) => i !== index) }, true)}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * The one "add entry" affordance per list, shaped to fit the block: `className`
 * gives it the tile/row shape, so it drops into the grid or list like a real
 * entry. Handles the empty list too — there is always exactly one of these at
 * the end.
 */
export function AddItemTile({
  blockId,
  blockType,
  max,
  className = "",
}: {
  blockId: string;
  blockType: string;
  max: number;
  className?: string;
}) {
  const edit = useLandingEdit();
  if (!edit) return null;

  const items = (edit.data(blockId).items as Record<string, unknown>[]) ?? [];
  if (items.length >= max) return null;

  return (
    <button
      type="button"
      data-testid="landing-add-item"
      disabled={edit.busy}
      onClick={() => {
        const item = freshItem(blockType, items.length);
        if (!item) return;
        edit.update(blockId, { ...edit.data(blockId), items: [...items, item] }, true);
      }}
      className={`flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-solid hover:bg-muted disabled:opacity-50 ${className}`}
    >
      <Plus className="h-4 w-4" />
      {edit.labels.addItem}
    </button>
  );
}
