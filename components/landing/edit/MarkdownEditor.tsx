"use client";

// Click a formatted body → edit its markdown source in a popover.
//
// This is the one text field that is deliberately NOT contentEditable. Typing
// straight into rendered markdown saves what the browser flattens it to, which
// means the first edit silently destroys every bold, list and link in the text.
// Editing the source keeps the formatting the author wrote.
//
// Saved without a reload while typing (nothing would change until the source is
// re-rendered anyway); the page re-renders once the popover closes.

import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useBlockData, useLandingEdit } from "./LandingEditProvider";

export function MarkdownEditor({
  blockId,
  field,
  children,
}: {
  blockId: string;
  field: string;
  children: ReactNode;
}) {
  const edit = useLandingEdit();
  const live = useBlockData(blockId);
  const [dirty, setDirty] = useState(false);

  if (!edit) return <>{children}</>;

  const value = (live[field] ?? { de: "", en: "" }) as Record<string, string>;

  return (
    <Popover
      onOpenChange={(open) => {
        // Re-render only when the editing is over, so the preview catches up
        // without the page reloading under every keystroke.
        if (!open && dirty) {
          setDirty(false);
          edit.refresh();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={edit.labels.editText}
          title={edit.labels.editText}
          data-landing-markdown-edit=""
          className="landing-edit-target block w-full text-left"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{edit.labels.editText}</p>
        <Textarea
          rows={10}
          className="font-mono text-xs"
          value={value[edit.locale] ?? ""}
          placeholder={edit.locale === "en" ? value.de : undefined}
          onChange={(e) => {
            setDirty(true);
            edit.update(blockId, { ...edit.data(blockId), [field]: { ...value, [edit.locale]: e.target.value } }, false);
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">{edit.labels.markdownHint}</p>
      </PopoverContent>
    </Popover>
  );
}
