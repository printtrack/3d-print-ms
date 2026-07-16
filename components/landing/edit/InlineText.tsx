"use client";

// One delegated listener for every editable string on the page.
//
// Replaces the old InlineEditBridge: no postMessage, no parent — it hands typed
// text straight to the provider, which saves it. Mounted once, inside the
// provider, only in edit mode.

import { useEffect } from "react";
import { useLandingEdit } from "./LandingEditProvider";

export function InlineText() {
  const edit = useLandingEdit();
  const setText = edit?.setText;

  useEffect(() => {
    if (!setText) return;

    // Turn the marked copy editable only now, with the listeners about to be
    // attached. Server-rendering contentEditable instead would let someone type
    // into the gap between paint and hydration, where nothing is listening and
    // the edit is silently dropped. See Editable.tsx.
    const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-edit]"));
    for (const el of fields) el.contentEditable = "true";

    function target(e: Event): HTMLElement | null {
      const node = e.target;
      if (!(node instanceof HTMLElement)) return null;
      return node.closest<HTMLElement>("[data-landing-edit]");
    }

    function onInput(e: Event) {
      const el = target(e);
      if (!el) return;
      const index = el.dataset.index;
      setText!(
        el.dataset.blockId!,
        el.dataset.field!,
        index === undefined ? undefined : Number(index),
        // textContent, not innerText/innerHTML: these fields are plain strings in
        // the DB, and a paste from Word must not smuggle markup into them.
        el.textContent ?? "",
        el.dataset.plain !== undefined,
      );
    }

    // Enter would insert a newline into a field the DB stores as one line.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      const el = target(e);
      if (!el) return;
      e.preventDefault();
      el.blur();
    }

    // Paste as plain text — the default drops styled HTML into the element.
    function onPaste(e: ClipboardEvent) {
      const el = target(e);
      if (!el) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, text.replace(/\s*\n\s*/g, " "));
    }

    // In edit mode a link click would navigate away from the page being edited.
    // The header has a "View" button for going to the real one.
    function onClick(e: MouseEvent) {
      const node = e.target;
      if (!(node instanceof HTMLElement)) return;
      if (node.closest("a")) e.preventDefault();
    }

    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    document.addEventListener("click", onClick);
    return () => {
      for (const el of fields) el.contentEditable = "false";
      document.removeEventListener("input", onInput);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("click", onClick);
    };
  }, [setText]);

  return null;
}
