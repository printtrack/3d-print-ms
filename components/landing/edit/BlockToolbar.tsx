"use client";

// The controls that used to be the side panel's block list and background field,
// now floating at the top-right of the block they belong to.
//
// Rendered by each block renderer when editing, inside that block's <section>,
// so it needs no portal and no rect tracking — it is simply positioned against
// its own parent. Appears on hover (and on focus, for keyboard users).

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BACKGROUNDS, BLOCK_DEFS, blockDef, isBlockType, type Background } from "@/lib/landing/blocks";
import { useLandingEdit } from "./LandingEditProvider";

export function BlockToolbar({ blockId, type }: { blockId: string; type: string }) {
  const edit = useLandingEdit();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!edit) return null;

  const ordered = [...edit.blocks].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((b) => b.id === blockId);
  const block = ordered[index];
  if (!block) return null;

  const def = isBlockType(type) ? blockDef(type) : null;
  const locked = def?.locked ?? false;
  const usedTypes = new Set(edit.blocks.map((b) => b.type));
  const label = edit.labels[`block_${type}`] ?? type;

  function setBackground(bg: Background) {
    edit!.update(blockId, { ...edit!.data(blockId), background: bg });
  }

  return (
    <>
      {/*
        Two wrappers, both load-bearing:

        The outer one is absolute over the whole section. It must be out of flow
        because the hero is `flex items-center` — a flow child there becomes a
        flex item, collapses to zero width, and `right-3` then measures against
        nothing and throws the bar off the left edge of the page.

        The inner one is sticky, not absolute. Pinned to the block's top edge the
        bar scrolls out of sight the moment you look at the middle of a
        full-height section, taking the controls away exactly while you use them.
        Sticky inside the absolute box follows the viewport for as long as any
        part of the section is on screen.

        top-20: the landing navbar is fixed at z-50 and would cover it. Same 80px
        the hero reserves with pt-20.
      */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <div className="sticky top-20 flex justify-end px-3 pt-3">
        <div className="landing-edit-chrome pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 p-1 shadow-md backdrop-blur">
        <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>

        <ToolButton
          label={edit.labels.moveUp}
          disabled={index === 0 || edit.busy}
          onClick={() => void edit.moveBlock(blockId, -1)}
        >
          <ChevronUp className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={edit.labels.moveDown}
          disabled={index === ordered.length - 1 || edit.busy}
          onClick={() => void edit.moveBlock(blockId, 1)}
        >
          <ChevronDown className="h-4 w-4" />
        </ToolButton>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={edit.labels.background}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Palette className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {edit.labels.background}
            </p>
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setBackground(bg)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  (edit.data(blockId).background as string) === bg ? "font-semibold" : ""
                }`}
              >
                <span
                  className="h-4 w-4 rounded border"
                  style={{
                    backgroundColor:
                      bg === "white"
                        ? "#ffffff"
                        : bg === "muted"
                          ? "oklch(0.97 0.004 240)"
                          : "var(--landing-hero-bg)",
                  }}
                />
                {edit.labels[`background_${bg}`]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <ToolButton
          label={block.visible ? edit.labels.hide : edit.labels.show}
          disabled={edit.busy}
          onClick={() => void edit.toggleVisible(blockId)}
        >
          {block.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </ToolButton>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={edit.labels.addBlockBelow}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="max-h-72 w-52 overflow-y-auto p-1" align="end">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {edit.labels.addBlockBelow}
            </p>
            {BLOCK_DEFS.map((d) => (
              <button
                key={d.type}
                type="button"
                disabled={(d.singleton && usedTypes.has(d.type)) || edit.busy}
                onClick={() => void edit.addBlock(d.type, blockId)}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {edit.labels[`block_${d.type}`] ?? d.type}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {locked ? (
          // The order form owns the #order-form anchor the page's CTAs point at.
          // Hiding it is reversible; deleting it would break those links.
          <span
            title={edit.labels.lockedHint}
            aria-label={edit.labels.lockedHint}
            className="p-1.5 text-muted-foreground/50"
          >
            <Lock className="h-4 w-4" />
          </span>
        ) : (
          <ToolButton
            label={edit.labels.deleteBlock}
            disabled={edit.busy}
            destructive
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </ToolButton>
        )}

          {edit.busy && <Loader2 className="mx-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{edit.labels.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{edit.labels.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{edit.labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void edit.deleteBlock(blockId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {edit.labels.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1.5 text-muted-foreground disabled:opacity-30 ${
        destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
