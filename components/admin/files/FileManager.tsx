"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FlaskConical, Paperclip, Plus, RotateCcw } from "lucide-react";
import Image from "next/image";
import { PartFileSection, type OrderPartData, type FilamentOption, type PartPhaseOption } from "./PartFileSection";
import { CATEGORY_LABELS, type OrderFileData, type FileCategory } from "./types";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES: FileCategory[] = ["DESIGN", "REFERENCE", "RESULT", "OTHER"];

interface FileManagerProps {
  orderId: string;
  files: OrderFileData[];
  onFilesChange: (files: OrderFileData[]) => void;
  parts: OrderPartData[];
  isAdmin: boolean;
  onPartsRefresh: () => Promise<void>;
  availableFilaments?: FilamentOption[];
  availablePartPhases?: PartPhaseOption[];
  machines?: Array<{ id: string; name: string }>;
  onPartUpdated?: (part: OrderPartData) => void;
  onPartDeleted?: (partId: string) => void;
  onPartAdded?: (part: OrderPartData) => void;
  isPrototype?: boolean;
  iterationCount?: number;
  onIterationChange?: (newCount: number) => void;
  teamMembers?: Array<{ id: string; name: string; email?: string }>;
}

export function FileManager({
  orderId,
  files,
  onFilesChange,
  parts,
  isAdmin,
  onPartsRefresh,
  availableFilaments = [],
  availablePartPhases = [],
  machines = [],
  onPartUpdated,
  onPartDeleted,
  onPartAdded,
  isPrototype = false,
  iterationCount = 1,
  onIterationChange,
  teamMembers = [],
}: FileManagerProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [savingPart, setSavingPart] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FileCategory>("DESIGN");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categoryCounts: Record<FileCategory, number> = {
    DESIGN: 0,
    REFERENCE: 0,
    RESULT: 0,
    OTHER: 0,
  };
  files.forEach((f) => {
    categoryCounts[f.category] += 1;
  });
  const nonEmptyCategoryCount = ALL_CATEGORIES.filter((c) => categoryCounts[c] > 0).length;
  const hasHiddenCategories = nonEmptyCategoryCount > 0 && nonEmptyCategoryCount < ALL_CATEGORIES.length;
  const visibleCategories = showAllCategories || files.length === 0
    ? ALL_CATEGORIES
    : ALL_CATEGORIES.filter((c) => categoryCounts[c] > 0 || c === activeCategory);

  const partNameById = Object.fromEntries(parts.map((p) => [p.id, p.name]));

  const orderLevelFiles = files.filter((f) => f.orderPartId === null);
  const hasParts = parts.length > 0;

  const sections: Array<{
    key: string;
    label: string | undefined;
    files: OrderFileData[];
    part: OrderPartData | null;
    variant?: "orphan";
  }> = [];

  // Parts first when they exist
  parts.forEach((p) => {
    sections.push({
      key: p.id,
      label: p.name,
      files: files.filter((f) => f.orderPartId === p.id),
      part: p,
    });
  });

  // Order-level section:
  //   - no parts → render as a single default "Dateien" section (no label)
  //   - parts exist + stray files → render as a subtle "Ohne Teil" section at the bottom
  //   - parts exist + no stray files → hide entirely
  if (!hasParts) {
    sections.unshift({
      key: "__order__",
      label: undefined,
      files: orderLevelFiles,
      part: null,
    });
  } else if (orderLevelFiles.length > 0) {
    sections.push({
      key: "__order__",
      label: "Ohne Teil",
      files: orderLevelFiles,
      part: null,
      variant: "orphan",
    });
  }

  async function uploadFiles(filesToUpload: File[], category: FileCategory, sectionKey: string) {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("orderId", orderId);
      fd.append("category", category);
      if (sectionKey !== "__order__") fd.append("partId", sectionKey);
      filesToUpload.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();

      onFilesChange([...files, ...(data.files ?? [])]);
      toast.success(
        filesToUpload.length === 1
          ? "Datei hochgeladen"
          : `${filesToUpload.length} Dateien hochgeladen`
      );
      await onPartsRefresh();
      router.refresh();
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleRecategorize(fileId: string, category: FileCategory) {
    const previousFiles = files;
    onFilesChange(files.map((f) => (f.id === fileId ? { ...f, category } : f)));
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) throw new Error();
    } catch {
      onFilesChange(previousFiles);
      toast.error("Fehler beim Kategorisieren");
    }
  }

  async function handleMoveFile(fileId: string, orderPartId: string | null) {
    const previousFiles = files;
    onFilesChange(files.map((f) => (f.id === fileId ? { ...f, orderPartId } : f)));
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderPartId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Datei verschoben");
      await onPartsRefresh();
    } catch {
      onFilesChange(previousFiles);
      toast.error("Fehler beim Verschieben");
    }
  }

  async function handleDeleteFile(fileId: string) {
    const previousFiles = files;
    onFilesChange(files.filter((f) => f.id !== fileId));
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Datei gelöscht");
      router.refresh();
    } catch {
      onFilesChange(previousFiles);
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleBulkRecategorize(category: FileCategory) {
    const ids = Array.from(selectedFileIds);
    onFilesChange(files.map((f) => (ids.includes(f.id) ? { ...f, category } : f)));
    setSelectedFileIds(new Set());
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/orders/${orderId}/files/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        })
      )
    );
    toast.success(`${ids.length} Datei${ids.length !== 1 ? "en" : ""} verschoben`);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedFileIds);
    onFilesChange(files.filter((f) => !ids.includes(f.id)));
    setSelectedFileIds(new Set());
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/orders/${orderId}/files/${id}`, { method: "DELETE" })
      )
    );
    toast.success(`${ids.length} Datei${ids.length !== 1 ? "en" : ""} gelöscht`);
    router.refresh();
  }

  function toggleExpand(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleNewIteration() {
    const newCount = iterationCount + 1;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iterationCount: newCount }),
      });
      if (!res.ok) throw new Error();
      onIterationChange?.(newCount);
      toast.success(`Prototyp-Iteration #${newCount} gestartet`);
      router.refresh();
    } catch {
      toast.error("Fehler beim Starten der Iteration");
    }
  }

  async function handleAddPart() {
    if (!newPartName.trim()) return;
    setSavingPart(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPartName.trim() }),
      });
      if (!res.ok) throw new Error();
      const part = await res.json();
      onPartAdded?.(part);
      setNewPartName("");
      setAddingPart(false);
      toast.success("Teil hinzugefügt");
    } catch {
      toast.error("Hinzufügen fehlgeschlagen");
    } finally {
      setSavingPart(false);
    }
  }

  const cardTitle = parts.length > 0 ? "Dateien & Teile" : "Dateien";

  return (
    <>
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-base">{cardTitle}</CardTitle>
            {files.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {files.length}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isAdmin && !addingPart && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAddingPart(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Teil
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 pb-4 space-y-3">
          {/* Prototype iteration banner */}
          {isPrototype && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
              <FlaskConical className="h-4 w-4 text-purple-600 shrink-0" />
              <span className="text-sm font-semibold text-purple-700">
                Prototyp · Iteration #{iterationCount}
              </span>
              <div className="flex-1" />
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={handleNewIteration}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Neue Iteration
                </Button>
              )}
            </div>
          )}

          {/* Card-level category filter */}
          {(files.length > 0 || hasParts) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {visibleCategories.map((cat) => {
                const count = categoryCounts[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all duration-150",
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-muted/50"
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                    {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
                  </button>
                );
              })}
              {hasHiddenCategories && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllCategories ? "Weniger" : "Mehr"}
                </button>
              )}
            </div>
          )}

          {/* Provisional new-part row (shown at top while adding) */}
          {isAdmin && addingPart && (
            <div className="flex gap-2 p-3 border border-dashed rounded-md bg-muted/20">
              <Input
                placeholder="Teilname *"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPart();
                  if (e.key === "Escape") { setAddingPart(false); setNewPartName(""); }
                }}
                autoFocus
              />
              <Button size="sm" onClick={handleAddPart} disabled={savingPart || !newPartName.trim()}>
                {savingPart ? "..." : "Hinzufügen"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAddingPart(false); setNewPartName(""); }}
              >
                Abbrechen
              </Button>
            </div>
          )}

          {sections.map(({ key, label, files: sectionFiles, part, variant }) => (
            <PartFileSection
              key={key}
              label={label}
              files={sectionFiles}
              orderId={orderId}
              partNameById={partNameById}
              isAdmin={isAdmin}
              uploading={uploading}
              activeCategory={activeCategory}
              onUpload={(picked, cat) => uploadFiles(picked, cat, key)}
              onRecategorize={handleRecategorize}
              onDelete={handleDeleteFile}
              onMove={handleMoveFile}
              moveTargets={parts.map((p) => ({ id: p.id, name: p.name }))}
              onPreview={setPreviewUrl}
              collapsedGroups={collapsedGroups}
              onToggleExpand={toggleExpand}
              selectedFileIds={selectedFileIds}
              onBulkRecategorize={handleBulkRecategorize}
              onBulkDelete={handleBulkDelete}
              onClearSelection={() => setSelectedFileIds(new Set())}
              variant={variant}
              isPrototype={isPrototype}
              collapsible={parts.length > 0 && variant !== "orphan"}
              defaultExpanded={part !== null || sectionFiles.length > 0 || parts.length === 0}
              partData={
                part && onPartUpdated && onPartDeleted
                  ? {
                      part,
                      availableFilaments,
                      availablePartPhases,
                      machines,
                      onPartUpdated,
                      onPartDeleted,
                    }
                  : undefined
              }
              teamMembers={teamMembers}
            />
          ))}

        </CardContent>
      </Card>

      {/* Image lightbox */}
      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null);
        }}
      >
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">Bildvorschau</DialogTitle>
          {previewUrl && (
            <div className="relative w-full aspect-video">
              <Image src={previewUrl} alt="Vorschau" fill className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
