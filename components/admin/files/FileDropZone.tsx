"use client";

import { useRef, useState, type DragEvent } from "react";
import { Upload, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXTENSIONS } from "./types";

interface FileDropZoneProps {
  /** Called when files are drag-and-dropped — triggers immediate upload */
  onFilesDropped: (files: File[]) => void;
  /** Called when files are chosen via click/file picker — triggers staged upload */
  onFilesSelected: (files: File[]) => void;
  uploading?: boolean;
  /** Compact mode: slim strip shown when files already exist in this section */
  compact?: boolean;
  /** Shown during drag-over: "Ablegen in {label}" instead of generic text */
  destinationLabel?: string;
  className?: string;
}

export function FileDropZone({
  onFilesDropped,
  onFilesSelected,
  uploading = false,
  compact = false,
  destinationLabel,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer select-none transition-all duration-150",
          isDragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30 text-muted-foreground",
          uploading && "opacity-50 pointer-events-none",
          className
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          tabIndex={-1}
          onChange={handleChange}
        />
        <Upload className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium">
          {isDragOver
            ? destinationLabel
              ? `Ablegen in ${destinationLabel}`
              : "Loslassen zum Hochladen"
            : "Weitere Datei hochladen oder hier ablegen"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer select-none transition-all duration-200",
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
          : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20",
        uploading && "opacity-50 pointer-events-none",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        tabIndex={-1}
        onChange={handleChange}
      />
      <div
        className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
          isDragOver ? "bg-primary/10" : "bg-muted"
        )}
      >
        <CloudUpload
          className={cn(
            "h-6 w-6 transition-colors",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="text-center">
        <p className={cn("text-sm font-medium transition-colors", isDragOver ? "text-primary" : "text-foreground")}>
          {isDragOver
            ? destinationLabel
              ? `Ablegen in ${destinationLabel}`
              : "Loslassen zum Hochladen"
            : "Dateien hier ablegen oder klicken"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, GIF, WebP, STL, OBJ, 3MF · max 50 MB
        </p>
      </div>
    </div>
  );
}
