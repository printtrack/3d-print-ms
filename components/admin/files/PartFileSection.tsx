"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Printer, ShieldAlert, ShieldCheck, Trash2, Plus, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "./FileDropZone";
import { FileVersionGroup } from "./FileVersionGroup";
import { FileListItem } from "./FileListItem";
import { BulkFileActions } from "./BulkFileActions";
import { CreateJobDialog } from "@/components/admin/CreateJobDialog";
import { PartEditDialog } from "./PartEditDialog";
import { PartLinkJobDialog } from "./PartLinkJobDialog";
import { type OrderFileData, type FileCategory } from "./types";
import { AssigneePicker, type AssigneeUser } from "@/components/admin/AssigneePicker";

export interface OrderPartData {
  id: string;
  orderId: string;
  name: string;
  description: string | null;
  filamentId: string | null;
  gramsEstimated: number | null;
  quantity: number;
  iterationCount: number;
  partPhaseId: string | null;
  partPhase: { id: string; name: string; color: string; isPrintReady: boolean; isReview: boolean; isPrinted: boolean } | null;
  createdAt: string;
  updatedAt: string;
  filament: {
    id: string;
    name: string;
    material: string;
    color: string;
    colorHex: string | null;
    brand: string | null;
  } | null;
  files: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    source: string;
    category: string;
    orderPartId: string | null;
    createdAt: string;
  }>;
  printJobParts: Array<{
    printJobId: string;
    printJob: { id: string; status: string; machine: { name: string } };
  }>;
  assignees: Array<{ user: { id: string; name: string; email: string } }>;
}

export interface FilamentOption {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string | null;
  brand: string | null;
  remainingGrams: number;
}

export interface PartPhaseOption {
  id: string;
  name: string;
  color: string;
  isPrintReady: boolean;
  isReview: boolean;
  isPrinted: boolean;
}

interface PartControlData {
  part: OrderPartData;
  availableFilaments: FilamentOption[];
  availablePartPhases: PartPhaseOption[];
  machines: Array<{ id: string; name: string }>;
  onPartUpdated: (part: OrderPartData) => void;
  onPartDeleted: (partId: string) => void;
}

interface PartFileSectionProps {
  label?: string;
  files: OrderFileData[];
  orderId: string;
  partNameById: Record<string, string>;
  isAdmin: boolean;
  uploading: boolean;
  activeCategory: FileCategory;
  onUpload: (files: File[], category: FileCategory) => void;
  onRecategorize: (fileId: string, category: FileCategory) => void;
  onDelete: (fileId: string) => void;
  onMove: (fileId: string, orderPartId: string | null) => void;
  moveTargets: Array<{ id: string; name: string }>;
  onPreview: (url: string) => void;
  collapsedGroups: Set<string>;
  onToggleExpand: (key: string) => void;
  selectedFileIds: Set<string>;
  onBulkRecategorize: (category: FileCategory) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  partData?: PartControlData;
  /** "orphan" = unassigned-files bucket rendered with subtler styling */
  variant?: "orphan";
  isPrototype?: boolean;
  teamMembers?: AssigneeUser[];
  verificationRequest?: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason?: string | null;
  };
  onApproveVerification?: (vrId: string) => void;
  onRejectVerification?: (vrId: string, reason: string | null) => void;
}

export function PartFileSection({
  label,
  files,
  orderId,
  partNameById,
  isAdmin,
  uploading,
  activeCategory,
  onUpload,
  onRecategorize,
  onDelete,
  onMove,
  moveTargets,
  onPreview,
  collapsedGroups,
  onToggleExpand,
  selectedFileIds,
  onBulkRecategorize,
  onBulkDelete,
  onClearSelection,
  collapsible = false,
  defaultExpanded = true,
  partData,
  variant,
  isPrototype = false,
  teamMembers = [],
  verificationRequest,
  onApproveVerification,
  onRejectVerification,
}: PartFileSectionProps) {
  const router = useRouter();
  const isOrphan = variant === "orphan";
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const dragCounter = useRef(0);
  const [isSectionDragOver, setIsSectionDragOver] = useState(false);

  // Part assignees state
  const part = partData?.part;
  const [partAssigneeIds, setPartAssigneeIds] = useState<string[]>(
    part?.assignees?.map((a) => a.user.id) ?? []
  );

  async function handlePartAssigneeChange(ids: string[]) {
    if (!part) return;
    setPartAssigneeIds(ids);
    try {
      const res = await fetch(`/api/admin/orders/${part.orderId}/parts/${part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: ids }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      partData?.onPartUpdated({ ...part, assignees: updated.assignees });
    } catch {
      toast.error("Zuweisung konnte nicht gespeichert werden");
      setPartAssigneeIds(part.assignees?.map((a) => a.user.id) ?? []);
    }
  }

  const hasPendingVerification = verificationRequest?.status === "PENDING";

  // VR inline approve/reject state
  const [approvingVr, setApprovingVr] = useState(false);
  const [rejectingVr, setRejectingVr] = useState(false);
  const [showRejectVrInput, setShowRejectVrInput] = useState(false);
  const [rejectVrMessage, setRejectVrMessage] = useState("");

  async function handleApproveVr() {
    if (!verificationRequest) return;
    setApprovingVr(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationRequestId: verificationRequest.id, action: "APPROVE" }),
      });
      if (!res.ok) throw new Error();
      onApproveVerification?.(verificationRequest.id);
      toast.success("Designfreigabe erteilt");
      router.refresh();
    } catch {
      toast.error("Freigabe fehlgeschlagen");
    } finally {
      setApprovingVr(false);
    }
  }

  async function handleRejectVr() {
    if (!verificationRequest) return;
    setRejectingVr(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationRequestId: verificationRequest.id,
          action: "REJECT",
          message: rejectVrMessage || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      onRejectVerification?.(verificationRequest.id, rejectVrMessage || null);
      setShowRejectVrInput(false);
      setRejectVrMessage("");
      toast.success("Freigabe abgelehnt");
      router.refresh();
    } catch {
      toast.error("Ablehnen fehlgeschlagen");
    } finally {
      setRejectingVr(false);
    }
  }

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [linkJobOpen, setLinkJobOpen] = useState(false);

  // Inline rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Past designs collapsible
  const [pastDesignsOpen, setPastDesignsOpen] = useState(false);

  // Parts: DESIGN category uses a "current + history" layout instead of grouped list
  const isDesignForPart = activeCategory === "DESIGN" && !!partData;

  const filteredFiles = files
    .filter((f) => f.category === activeCategory)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const groups = filteredFiles.reduce<Record<string, typeof filteredFiles>>((acc, f) => {
    (acc[f.originalName] ??= []).push(f);
    return acc;
  }, {});

  const selectedInSection = selectedFileIds.size > 0
    ? new Set(Array.from(selectedFileIds).filter((id) => files.some((f) => f.id === id)))
    : new Set<string>();

  const sectionGroupPrefix = label ?? "__order__";


  // Drag-and-drop: whole section acts as a drop target, auto-expands on drag
  function handleDragEnter(e: DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current++;
    setIsSectionDragOver(true);
    if (collapsible && !isExpanded) setIsExpanded(true);
  }
  function handleDragLeave() {
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsSectionDragOver(false);
  }
  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }
  function handleDrop(e: DragEvent) {
    dragCounter.current = 0;
    setIsSectionDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    e.preventDefault();
    onUpload(dropped, activeCategory);
  }

  async function handleRename() {
    if (!partData) return;
    const newName = renameValue.trim();
    setRenaming(false);
    if (!newName || newName === partData.part.name) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts/${partData.part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      partData.onPartUpdated(updated);
      toast.success("Teil umbenannt");
    } catch {
      toast.error("Fehler beim Umbenennen");
    }
  }

  async function handlePhaseChange(phaseId: string | null) {
    if (!partData) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts/${partData.part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partPhaseId: phaseId }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      partData.onPartUpdated(updated);
    } catch {
      toast.error("Fehler beim Speichern der Phase");
    }
  }

  async function handleFilamentChange(filamentId: string | null) {
    if (!partData) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts/${partData.part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filamentId }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      partData.onPartUpdated(updated);
    } catch {
      toast.error("Fehler beim Speichern des Filaments");
    }
  }

  async function handlePartDelete() {
    if (!partData) return;
    if (!confirm(`Teil "${partData.part.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts/${partData.part.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      partData.onPartDeleted(partData.part.id);
      toast.success("Teil gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  // --- Header rendering ------------------------------------------------------

  function renderHeader() {
    if (!label) return null;

    // Orphan ("Ohne Teil") — quieter one-line header
    if (isOrphan) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground border-b border-dashed">
          <span className="font-medium uppercase tracking-wide">{label}</span>
        </div>
      );
    }

    const part = partData?.part;
    const phaseColor = part?.partPhase?.color;

    return (
      <div
        className={cn(
          "border-b bg-muted/40",
          collapsible && "cursor-pointer select-none hover:bg-muted/60 transition-colors"
        )}
        style={phaseColor ? { boxShadow: `inset 3px 0 0 0 ${phaseColor}` } : undefined}
        onClick={collapsible ? () => setIsExpanded((v) => !v) : undefined}
      >
        {/* Primary line */}
        <div className="flex items-center gap-2 px-3 py-2">
          {collapsible && (
            isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {renaming && partData ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setRenaming(false); setRenameValue(""); }
              }}
              onBlur={handleRename}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold bg-background border rounded px-1.5 py-0.5 h-6 outline-none focus:ring-2 focus:ring-ring min-w-0 flex-1"
            />
          ) : (
            <span
              className={cn(
                "text-sm font-semibold text-foreground truncate",
                partData && "cursor-text"
              )}
              title={partData ? "Doppelklick zum Umbenennen" : undefined}
              onDoubleClick={
                partData
                  ? (e) => {
                      e.stopPropagation();
                      setRenameValue(partData.part.name);
                      setRenaming(true);
                    }
                  : undefined
              }
            >
              {label}
            </span>
          )}
          {part && part.quantity > 1 && (
            <span className="text-xs text-muted-foreground bg-background/70 border rounded-full px-1.5 py-0.5">
              ×{part.quantity}
            </span>
          )}
          {part && partData && partData.availablePartPhases.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 border transition-colors",
                      part.partPhase
                        ? "border-transparent hover:opacity-80"
                        : "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/60"
                    )}
                    style={
                      part.partPhase
                        ? {
                            backgroundColor: `${part.partPhase.color}20`,
                            color: part.partPhase.color,
                          }
                        : undefined
                    }
                  >
                    {part.partPhase ? (
                      <>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: part.partPhase.color }}
                        />
                        {part.partPhase.name}
                      </>
                    ) : (
                      "Phase wählen"
                    )}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {partData.availablePartPhases.map((pp) => {
                    const blocked = pp.isPrintReady && hasPendingVerification;
                    return (
                      <DropdownMenuItem
                        key={pp.id}
                        onClick={blocked ? undefined : () => handlePhaseChange(pp.id)}
                        disabled={blocked}
                        title={blocked ? "Erst Designfreigabe einholen" : undefined}
                        className={cn(
                          "gap-2",
                          part.partPhaseId === pp.id && "bg-accent"
                        )}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pp.color }}
                        />
                        <span className="flex-1">{pp.name}</span>
                        {blocked ? (
                          <ShieldAlert className="h-3 w-3 text-amber-500" />
                        ) : pp.isPrintReady ? (
                          <Printer className="h-3 w-3 text-muted-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                  {part.partPhase && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handlePhaseChange(null)}
                        className="text-muted-foreground"
                      >
                        Keine Phase
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="flex-1" />

          {/* Part assignee picker — only when partData present and admin */}
          {isAdmin && partData && teamMembers.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <AssigneePicker
                users={teamMembers}
                value={partAssigneeIds}
                onChange={handlePartAssigneeChange}
                compact
              />
            </div>
          )}

          {/* Linked job badge */}
          {part && part.printJobParts && (() => {
            const activeLinks = part.printJobParts.filter(
              (pjp) => pjp.printJob.status !== "DONE" && pjp.printJob.status !== "CANCELLED"
            );
            if (activeLinks.length === 0) return null;
            return (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {activeLinks.length === 1 ? (
                  <a
                    href={`/admin/jobs?jobId=${activeLinks[0].printJobId}`}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    title={activeLinks[0].printJob.machine.name}
                  >
                    <Link2 className="h-2.5 w-2.5" />
                    {activeLinks[0].printJob.machine.name}
                  </a>
                ) : (
                  <a
                    href="/admin/jobs"
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    title={activeLinks.map((l) => l.printJob.machine.name).join(", ")}
                  >
                    <Link2 className="h-2.5 w-2.5" />
                    {`${activeLinks.length} Jobs`}
                  </a>
                )}
              </div>
            );
          })()}

          {isAdmin && partData && part?.partPhase?.isPrintReady && (() => {
            const hasActiveJob = part.printJobParts?.some(
              (pjp) => pjp.printJob.status !== "DONE" && pjp.printJob.status !== "CANCELLED"
            );
            if (hasActiveJob) return null;
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-6 w-6"
                      title="Zu Druckjob hinzufügen"
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setLinkJobOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Bestehendem Job zuweisen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateJobOpen(true)}>
                      <Printer className="h-3.5 w-3.5 mr-2" />
                      Neuen Job erstellen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })()}

          {isAdmin && partData && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Teil-Optionen">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handlePartDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Secondary line — filament chip + iteration + description */}
        {part && (part.filament || (isAdmin && partData) || (isPrototype && part.iterationCount > 0) || part.description) && (
          <div className="flex items-center gap-2 px-3 pb-2 text-[11px] text-muted-foreground">
            {isAdmin && partData ? (() => {
              const materials = [...new Set(partData.availableFilaments.map((f) => f.material))].sort();
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded border transition-colors",
                          part.filament
                            ? "border-transparent hover:bg-muted/60 text-muted-foreground"
                            : "border-dashed border-muted-foreground/40 text-muted-foreground/70 hover:bg-muted/40"
                        )}
                        title="Filament auswählen"
                      >
                        {part.filament ? (
                          <>
                            {part.filament.colorHex && (
                              <span
                                className="w-2 h-2 rounded-full border border-border shrink-0"
                                style={{ backgroundColor: part.filament.colorHex }}
                              />
                            )}
                            {part.filament.name}
                          </>
                        ) : (
                          "Filament wählen"
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {materials.map((mat) => (
                        <div key={mat}>
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground py-1">
                            {mat}
                          </DropdownMenuLabel>
                          {partData.availableFilaments
                            .filter((f) => f.material === mat)
                            .map((f) => (
                              <DropdownMenuItem
                                key={f.id}
                                onClick={() => handleFilamentChange(f.id)}
                                className={cn("gap-2", part.filamentId === f.id && "bg-accent")}
                              >
                                {f.colorHex && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-border"
                                    style={{ backgroundColor: f.colorHex }}
                                  />
                                )}
                                <span className="flex-1 truncate">{f.name}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{f.remainingGrams} g</span>
                              </DropdownMenuItem>
                            ))}
                        </div>
                      ))}
                      {part.filament && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleFilamentChange(null)}
                            className="text-muted-foreground"
                          >
                            Kein Filament
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })() : part.filament ? (
              <span className="flex items-center gap-1.5">
                {part.filament.colorHex && (
                  <span
                    className="w-2 h-2 rounded-full border border-border"
                    style={{ backgroundColor: part.filament.colorHex }}
                  />
                )}
                {part.filament.name}
              </span>
            ) : null}
            {isPrototype && part.iterationCount > 0 && (
              <span className="text-purple-600">Iter. #{part.iterationCount}</span>
            )}
            {part.description && (
              <span className="truncate" title={part.description}>
                · {part.description}
              </span>
            )}
          </div>
        )}

        {/* Inline design-review banner — always visible in header regardless of collapse */}
        {verificationRequest && (
          <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
            {verificationRequest.status === "PENDING" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-amber-800 flex-1">Designfreigabe ausstehend</span>
                  {isAdmin && !showRejectVrInput && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={handleApproveVr}
                        disabled={approvingVr}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {approvingVr ? "..." : "Erteilen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setShowRejectVrInput(true)}
                      >
                        Ablehnen
                      </Button>
                    </>
                  )}
                </div>
                {isAdmin && showRejectVrInput && (
                  <div className="space-y-1.5">
                    <Textarea
                      placeholder="Ablehnungsgrund (optional)"
                      value={rejectVrMessage}
                      onChange={(e) => setRejectVrMessage(e.target.value)}
                      className="text-xs min-h-[60px] resize-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs"
                        onClick={handleRejectVr}
                        disabled={rejectingVr}
                      >
                        {rejectingVr ? "..." : "Ablehnen bestätigen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => { setShowRejectVrInput(false); setRejectVrMessage(""); }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {verificationRequest.status === "REJECTED" && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive">
                  <X className="h-3.5 w-3.5 shrink-0" />
                  Abgelehnt
                </div>
                {verificationRequest.rejectionReason && (
                  <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                    „{verificationRequest.rejectionReason}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Body rendering --------------------------------------------------------

  return (
    <>
      <div
        data-testid="part-section"
        className={cn(
          "rounded-lg overflow-hidden transition-colors",
          isOrphan ? "border border-dashed bg-muted/10" : "border",
          isSectionDragOver && "border-primary bg-primary/5"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {renderHeader()}

        {isExpanded && (
          <div className="p-3 space-y-3">
            {/* Drop zone */}
            <FileDropZone
              onFilesDropped={(dropped) => onUpload(dropped, activeCategory)}
              onFilesSelected={(picked) => onUpload(picked, activeCategory)}
              uploading={uploading}
              compact={files.length > 0}
              destinationLabel={label}
            />

            {/* Bulk actions */}
            {isAdmin && selectedInSection.size > 0 && (
              <BulkFileActions
                selectedCount={selectedInSection.size}
                onRecategorize={onBulkRecategorize}
                onDelete={onBulkDelete}
                onClearSelection={onClearSelection}
              />
            )}

            {/* File list — Design gets a special "current + history" layout for parts */}
            <div>
              {isDesignForPart ? (
                filteredFiles.length > 0 ? (
                  <div className="space-y-3">
                    {/* Current design */}
                    <FileListItem
                      file={filteredFiles[0]}
                      orderId={orderId}
                      partNameById={partNameById}
                      isAdmin={isAdmin}
                      isCurrent={true}
                      onRecategorize={onRecategorize}
                      onDelete={onDelete}
                      onMove={onMove}
                      moveTargets={moveTargets}
                      currentPartId={partData?.part.id ?? null}
                      onPreview={onPreview}
                    />

                    {/* Past designs */}
                    {filteredFiles.length > 1 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setPastDesignsOpen((v) => !v)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {pastDesignsOpen ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Frühere Designs ({filteredFiles.length - 1})
                        </button>
                        {pastDesignsOpen && (
                          <div className="space-y-3 border-l pl-3 ml-2 mt-2">
                            {filteredFiles.slice(1).map((f) => (
                              <FileListItem
                                key={f.id}
                                file={f}
                                orderId={orderId}
                                partNameById={partNameById}
                                isAdmin={isAdmin}
                                isCurrent={false}
                                onRecategorize={onRecategorize}
                                onDelete={onDelete}
                                onMove={onMove}
                                moveTargets={moveTargets}
                                currentPartId={partData?.part.id ?? null}
                                onPreview={onPreview}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Noch kein Design</p>
                    <p className="text-xs text-muted-foreground">
                      Eine STL, 3MF oder OBJ Datei definiert dieses Teil. Ziehe sie hier hin oder oben ablegen.
                    </p>
                  </div>
                )
              ) : filteredFiles.length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(groups).map(([name, group]) => {
                    const groupKey = `${activeCategory}-${sectionGroupPrefix}-${name}`;
                    return (
                      <FileVersionGroup
                        key={groupKey}
                        groupKey={groupKey}
                        files={group}
                        orderId={orderId}
                        partNameById={partNameById}
                        isAdmin={isAdmin}
                        isExpanded={collapsedGroups.has(groupKey)}
                        onToggleExpand={onToggleExpand}
                        onRecategorize={onRecategorize}
                        onDelete={onDelete}
                        onMove={onMove}
                        moveTargets={moveTargets}
                        currentPartId={partData?.part.id ?? null}
                        onPreview={onPreview}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Keine Dateien in dieser Kategorie
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {partData && (
        <>
          <PartEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            orderId={orderId}
            part={partData.part}
            availableFilaments={partData.availableFilaments}
            onPartUpdated={partData.onPartUpdated}
          />
          <PartLinkJobDialog
            open={linkJobOpen}
            onOpenChange={setLinkJobOpen}
            partId={partData.part.id}
            partName={partData.part.name}
            activeJobId={partData.part.printJobParts?.find(
              (pjp) => pjp.printJob.status !== "DONE" && pjp.printJob.status !== "CANCELLED"
            )?.printJobId ?? null}
            onLinked={() => router.refresh()}
          />
          <CreateJobDialog
            open={createJobOpen}
            onOpenChange={setCreateJobOpen}
            machines={partData.machines}
            onCreated={async (job) => {
              await fetch(`/api/admin/jobs/${job.id}/parts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderPartId: partData.part.id }),
              });
              toast.success(`Teil "${partData.part.name}" zum Druckjob hinzugefügt`);
              router.refresh();
            }}
          />
        </>
      )}
    </>
  );
}
