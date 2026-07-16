"use client";

// Click an image (or its empty placeholder) → upload a replacement and set the
// description screen readers read out.
//
// Alt text has no place on the page, so it cannot be edited "inline" in the
// literal sense — it lives in this popover, attached to the image it describes,
// which is as close as it gets.

import { useRef, useState, type ReactNode } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBlockData, useLandingEdit } from "./LandingEditProvider";

/**
 * `field`/`altField` are paths into the block data, matching the text editor's
 * convention: "image" or "items.image" with an index.
 */
export function ImageEditor({
  blockId,
  field,
  altField,
  index,
  children,
}: {
  blockId: string;
  field: string;
  altField: string;
  index?: number;
  children: ReactNode;
}) {
  const edit = useLandingEdit();
  // Reactive, so the alt field shows what was just typed into it.
  const live = useBlockData(blockId);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!edit) return <>{children}</>;

  function liveRead(path: string): unknown {
    if (index === undefined) return live[path];
    const [arrayKey, prop] = path.split(".");
    const items = (live[arrayKey] as Record<string, unknown>[]) ?? [];
    return items[index]?.[prop];
  }

  function write(path: string, value: unknown, reload: boolean) {
    const data = edit!.data(blockId);
    if (index === undefined) {
      edit!.update(blockId, { ...data, [path]: value }, reload);
      return;
    }
    const [arrayKey, prop] = path.split(".");
    const items = [...((data[arrayKey] as Record<string, unknown>[]) ?? [])];
    if (!items[index]) return;
    items[index] = { ...items[index], [prop]: value };
    edit!.update(blockId, { ...data, [arrayKey]: items }, reload);
  }

  const alt = (liveRead(altField) ?? { de: "", en: "" }) as Record<string, string>;

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/uploads/landing", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? edit!.labels.uploadFailed);
      write(field, json.url, true);
      toast.success(edit!.labels.uploadDone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : edit!.labels.uploadFailed);
    } finally {
      setUploading(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={edit.labels.editImage}
          title={edit.labels.editImage}
          data-landing-image-edit=""
          className="landing-edit-target block w-full text-left"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {uploading ? edit.labels.uploading : edit.labels.replaceImage}
          </Button>
          {Boolean(liveRead(field)) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => write(field, "", true)}
              aria-label={edit.labels.removeImage}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{edit.labels.imageHint}</p>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">{edit.labels.altLabel}</Label>
          <Input
            value={alt[edit.locale] ?? ""}
            placeholder={edit.locale === "en" ? alt.de : undefined}
            onChange={(e) => write(altField, { ...alt, [edit.locale]: e.target.value }, false)}
          />
          <p className="text-xs text-muted-foreground">{edit.labels.altHint}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
