"use client";

// The last few fields that are neither text nor an asset: how wide an image
// runs, which side it sits on. They are properties of the layout, so they get a
// small control attached to the layout rather than a form elsewhere.

import { Maximize2, PanelLeft, PanelRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBlockData, useLandingEdit } from "./LandingEditProvider";

const IMAGE_WIDTHS = ["narrow", "wide", "full"] as const;

export function WidthEditor({ blockId }: { blockId: string }) {
  const edit = useLandingEdit();
  const live = useBlockData(blockId);
  if (!edit) return null;

  const current = (live.width ?? "wide") as string;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={edit.labels.width}
          title={edit.labels.width}
          className="landing-edit-chrome ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-popover align-middle text-muted-foreground shadow-sm hover:text-foreground"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="center">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{edit.labels.width}</p>
        {IMAGE_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            // Changes the server-rendered class → needs a re-render.
            onClick={() => edit.update(blockId, { ...edit.data(blockId), width: w }, true)}
            className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
              current === w ? "font-semibold" : ""
            }`}
          >
            {edit.labels[`width_${w}`] ?? w}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ImageSideEditor({ blockId }: { blockId: string }) {
  const edit = useLandingEdit();
  const live = useBlockData(blockId);
  if (!edit) return null;

  const side = (live.imageSide ?? "right") as string;

  return (
    <div className="landing-edit-chrome absolute left-3 top-3 z-30 flex gap-0.5 rounded-lg border border-border bg-popover/95 p-1 shadow-sm backdrop-blur">
      {(["left", "right"] as const).map((s) => {
        const Icon = s === "left" ? PanelLeft : PanelRight;
        return (
          <button
            key={s}
            type="button"
            aria-label={edit.labels[`side_${s}`] ?? s}
            title={edit.labels[`side_${s}`] ?? s}
            onClick={() => edit.update(blockId, { ...edit.data(blockId), imageSide: s }, true)}
            className={`rounded p-1.5 hover:bg-muted ${
              side === s ? "bg-muted text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
