"use client";

// Appending a block at the end of the page. Every other insertion happens from a
// block's own toolbar ("add below"), but the end of the page — and an empty page
// — has no block to hang that off.

import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BLOCK_DEFS } from "@/lib/landing/blocks";
import { useLandingEdit } from "./LandingEditProvider";

export function AddBlockBar() {
  const edit = useLandingEdit();
  if (!edit) return null;

  const usedTypes = new Set(edit.blocks.map((b) => b.type));

  return (
    <div className="border-t border-dashed bg-muted/30 py-6 text-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="landing-add-block"
            disabled={edit.busy}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-popover px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {edit.labels.addBlock}
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-h-72 w-52 overflow-y-auto p-1" align="center">
          {BLOCK_DEFS.map((d) => (
            <button
              key={d.type}
              type="button"
              disabled={(d.singleton && usedTypes.has(d.type)) || edit.busy}
              onClick={() => void edit.addBlock(d.type)}
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {edit.labels[`block_${d.type}`] ?? d.type}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
