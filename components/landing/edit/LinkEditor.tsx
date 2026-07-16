"use client";

// A button's *target* has no representation on the page — you cannot type it
// into anything. This popover hangs it off the button itself: click the pencil
// beside a CTA to say where it goes. The label stays inline-editable, because
// that one is visible text.

import { Link2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBlockData, useLandingEdit } from "./LandingEditProvider";

export function LinkEditor({ blockId, field }: { blockId: string; field: string }) {
  const edit = useLandingEdit();
  const live = useBlockData(blockId);
  if (!edit) return null;

  const href = (live[field] ?? "") as string;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={edit.labels.editLink}
          title={edit.labels.editLink}
          data-landing-link-edit=""
          className="landing-edit-chrome ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-popover align-middle text-muted-foreground shadow-sm hover:text-foreground"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="center">
        <div className="space-y-1.5">
          <Label className="text-xs">{edit.labels.linkTarget}</Label>
          <Input
            value={href}
            placeholder="#order-form"
            // Invisible on the page → no reload; a reload here would close this
            // popover on every keystroke.
            onChange={(e) => edit.update(blockId, { ...edit.data(blockId), [field]: e.target.value }, false)}
          />
          <p className="text-xs text-muted-foreground">{edit.labels.linkHint}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
