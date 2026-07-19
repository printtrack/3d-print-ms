"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Printer, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrintJob } from "./JobCard";
import { AssigneePicker } from "@/components/admin/AssigneePicker";
import { JobVerificationDialog } from "./JobVerificationDialog";

type DispatchStatus =
  | "QUEUED"
  | "UPLOADING"
  | "UPLOADED"
  | "HELD"
  | "STARTED"
  | "PRINTING"
  | "DONE"
  | "FAILED"
  | "CANCELLED";

interface DispatchInfo {
  id: string;
  status: DispatchStatus;
  holdReason: string | null;
  error: string | null;
  createdAt: string;
  printJobFile: { originalName: string } | null;
}

interface PrinterStateInfo {
  connected: boolean;
  state: string | null;
  error?: string;
}

interface JobDetailDialogProps {
  job: PrintJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (job: PrintJob) => void;
  onDeleted: (jobId: string) => void;
  teamMembers?: Array<{ id: string; name: string; email: string }>;
}

const STATUS_OPTIONS = [
  { value: "PLANNED", label: "Geplant" },
  { value: "SLICED", label: "Gesliced" },
  { value: "IN_PROGRESS", label: "Im Druck" },
  { value: "AWAITING_VERIFICATION", label: "Verifikation ausstehend" },
  { value: "DONE", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Storniert" },
] as const;

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_COLORS: Record<PrintJob["status"], string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  SLICED: "bg-purple-100 text-purple-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  AWAITING_VERIFICATION: "bg-orange-100 text-orange-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

const PRINTER_STATE_LABELS: Record<string, string> = {
  IDLE: "Bereit",
  READY: "Bereit",
  PRINTING: "Druckt",
  PAUSED: "Pausiert",
  FINISHED: "Fertig (Platte belegt)",
  ERROR: "Fehler",
  OFFLINE: "Offline",
};

const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  QUEUED: "In Warteschlange",
  UPLOADING: "Wird übertragen",
  UPLOADED: "Übertragen",
  HELD: "Wartet auf Start",
  STARTED: "Gestartet",
  PRINTING: "Druckt",
  DONE: "Abgeschlossen",
  FAILED: "Fehlgeschlagen",
  CANCELLED: "Abgebrochen",
};

const DISPATCH_STATUS_COLORS: Record<DispatchStatus, string> = {
  QUEUED: "bg-blue-100 text-blue-700",
  UPLOADING: "bg-blue-100 text-blue-700",
  UPLOADED: "bg-blue-100 text-blue-700",
  HELD: "bg-amber-100 text-amber-700",
  STARTED: "bg-emerald-100 text-emerald-700",
  PRINTING: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

// Search results are grouped by order
interface OrderSearchResult {
  id: string;
  customerName: string;
  customerEmail: string;
  parts: Array<{
    id: string;
    name: string;
    material: string | null;
    materialAny: boolean;
    color: string | null;
    colorAny: boolean;
    colorHex: string | null;
    quantity: number;
  }>;
}

export function JobDetailDialog({
  job,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  teamMembers = [],
}: JobDetailDialogProps) {
  const [status, setStatus] = useState<PrintJob["status"]>("PLANNED");
  const [plannedDate, setPlannedDate] = useState("");
  const [plannedTime, setPlannedTime] = useState("08:00");
  const [printTimeMinutes, setPrintTimeMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [searchResults, setSearchResults] = useState<OrderSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [downloadingStl, setDownloadingStl] = useState(false);
  const [downloadingOrca, setDownloadingOrca] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchInfo[]>([]);
  const [printerState, setPrinterState] = useState<PrinterStateInfo | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (job) {
      setStatus(job.status);
      setPlannedDate(job.plannedAt ? toLocalDate(job.plannedAt) : "");
      setPlannedTime(job.plannedAt ? toLocalTime(job.plannedAt) : "08:00");
      setPrintTimeMinutes(job.printTimeMinutes ? String(job.printTimeMinutes) : "");
      setNotes(job.notes ?? "");
      setAssigneeIds(job.assignees?.map((a) => a.user.id) ?? []);
      setPartSearch("");
      setSearchResults([]);
    }
  }, [job]);

  // Load dispatch history + live printer state whenever the dialog opens.
  useEffect(() => {
    if (!job || !open) {
      setDispatches([]);
      setPrinterState(null);
      return;
    }
    refreshDispatchInfo(job.id, job.machineId);
  }, [job, open]);

  async function refreshDispatchInfo(jobId: string, machineId: string) {
    try {
      const [dRes, sRes] = await Promise.all([
        fetch(`/api/admin/jobs/${jobId}/dispatch`),
        fetch(`/api/admin/machines/${machineId}/status`),
      ]);
      if (dRes.ok) setDispatches(await dRes.json());
      if (sRes.ok) {
        const s = await sRes.json();
        setPrinterState({ connected: s.connected, state: s.status?.state ?? null, error: s.error });
      }
    } catch {
      /* non-fatal — the dispatch panel just stays empty */
    }
  }

  // Unique material+color requirements from parts (for display when no G-code data yet)
  const partFilaments = useMemo(() => {
    if (!job) return [];
    const map = new Map<string, { id: string; name: string; material: string; colorHex: string | null }>();
    for (const jp of job.parts) {
      const op = jp.orderPart;
      const material = op.materialAny ? "egal" : op.material;
      const color = op.colorAny ? "egal" : op.color;
      if (!material && !color) continue;
      const key = `${material ?? ""}|${color ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: [material, color].filter(Boolean).join(" "),
          material: material ?? "",
          colorHex: op.colorHex,
        });
      }
    }
    return [...map.values()];
  }, [job]);

  if (!job) return null;

  const assignedPartIds = new Set(job.parts.map((p) => p.orderPartId));

  const sliceFiles = job.files ?? [];
  const latestDispatch = dispatches[0] ?? null;

  async function handleDispatch() {
    if (!job) return;
    if (sliceFiles.length === 0) {
      toast.error("Keine Druckdatei vorhanden");
      return;
    }
    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 502) {
        toast.error(data.error || "Senden fehlgeschlagen");
        return;
      }
      const d = data.dispatch as DispatchInfo | undefined;
      if (d?.status === "STARTED") {
        toast.success("An Drucker gesendet – Druck gestartet");
        setStatus("IN_PROGRESS");
        onUpdated({ ...job, status: "IN_PROGRESS" });
      } else if (d?.status === "HELD") {
        toast.success(
          d.holdReason === "bed_occupied"
            ? "Datei gesendet – Platte belegt, bitte manuell starten"
            : "Datei gesendet – Drucker beschäftigt, wartet auf Start"
        );
      } else if (d?.status === "FAILED") {
        toast.error(d.error || "Senden an Drucker fehlgeschlagen");
      }
      await refreshDispatchInfo(job.id, job.machineId);
    } catch {
      toast.error("Senden fehlgeschlagen");
    } finally {
      setDispatching(false);
    }
  }

  async function handleStartHeld(dispatchId: string) {
    if (!job) return;
    setStartingId(dispatchId);
    try {
      const res = await fetch(`/api/admin/dispatches/${dispatchId}/start`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Start fehlgeschlagen");
        return;
      }
      toast.success("Druck gestartet");
      setStatus("IN_PROGRESS");
      onUpdated({ ...job, status: "IN_PROGRESS" });
      await refreshDispatchInfo(job.id, job.machineId);
    } catch {
      toast.error("Start fehlgeschlagen");
    } finally {
      setStartingId(null);
    }
  }

  async function handleCancelDispatch(dispatchId: string) {
    if (!job) return;
    try {
      const res = await fetch(`/api/admin/dispatches/${dispatchId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Abbrechen fehlgeschlagen");
        return;
      }
      await refreshDispatchInfo(job.id, job.machineId);
    } catch {
      toast.error("Abbrechen fehlgeschlagen");
    }
  }

  async function handleSave() {
    if (!job) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          plannedAt: plannedDate
            ? new Date(`${plannedDate}T${plannedTime || "00:00"}`).toISOString()
            : null,
          ...(job.printTimeFromGcode ? {} : { printTimeMinutes: printTimeMinutes ? parseInt(printTimeMinutes, 10) : null }),
          notes: notes.trim() || null,
          assigneeIds,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "");
      }
      const { job: updated, warnings } = await res.json();
      onUpdated(updated);
      toast.success("Job aktualisiert");
      for (const w of warnings ?? []) toast.warning(w);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!job) return;
    if (!confirm("Druckjob wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Löschen");
        return;
      }
      onDeleted(job.id);
      onOpenChange(false);
      toast.success("Job gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  function handleSearchChange(value: string) {
    setPartSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/orders?search=${encodeURIComponent(value)}`);
        if (!res.ok) return;
        const data: OrderSearchResult[] = await res.json();
        // Filter to only orders that have at least one unassigned part
        const filtered = data
          .map((order) => ({
            ...order,
            parts: (order.parts ?? []).filter((p) => !assignedPartIds.has(p.id)),
          }))
          .filter((order) => order.parts.length > 0)
          .slice(0, 5);
        setSearchResults(filtered);
      } catch { /* ignore */ } finally {
        setSearchLoading(false);
      }
    }, 250);
  }

  async function handleAddPart(orderPartId: string) {
    if (!job) return;
    setAddingPart(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderPartId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Fehler beim Hinzufügen");
        return;
      }
      const refreshed = await fetch(`/api/admin/jobs/${job.id}`).then((r) => r.json());
      onUpdated(refreshed);
      setPartSearch("");
      setSearchResults([]);
      toast.success("Teil hinzugefügt");
    } catch {
      toast.error("Fehler beim Hinzufügen");
    } finally {
      setAddingPart(false);
    }
  }

  async function handleRemovePart(orderPartId: string) {
    if (!job) return;
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/parts/${orderPartId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const refreshed = await fetch(`/api/admin/jobs/${job.id}`).then((r) => r.json());
      onUpdated(refreshed);
      toast.success("Teil entfernt");
    } catch {
      toast.error("Fehler beim Entfernen");
    }
  }

  async function handleSliceFileUpload(file: File) {
    if (!job) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/jobs/${job.id}/files`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Upload");
        return;
      }
      const { job: updated, warnings } = await res.json();
      onUpdated(updated);
      toast.success("Slicing-Datei hochgeladen");
      for (const w of warnings ?? []) toast.warning(w);
    } catch {
      toast.error("Fehler beim Upload");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteSliceFile(fileId: string) {
    if (!job) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const refreshed = await fetch(`/api/admin/jobs/${job.id}`).then((r) => r.json());
      onUpdated(refreshed);
      toast.success("Datei gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setDeletingFileId(null);
    }
  }

  async function handleStlDownload() {
    if (!job) return;
    setDownloadingStl(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/stl-download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-${job.id}-stl-files.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Fehler beim Download");
    } finally {
      setDownloadingStl(false);
    }
  }

  async function handle3mfDownload() {
    if (!job) return;
    setDownloadingOrca(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/orca-download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-${job.id}.3mf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Fehler beim Download");
    } finally {
      setDownloadingOrca(false);
    }
  }

  const hasStlParts = job.parts.some((jp) => jp.orderPart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Druckjob — {job.machine.name}
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", STATUS_COLORS[job.status])}>
              {STATUS_OPTIONS.find((s) => s.value === job.status)?.label}
            </span>
            {job.shortCode && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground border">
                {job.shortCode}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PrintJob["status"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Geplanter Start — full width so date + time don't clip */}
          <div className="space-y-2">
            <Label>Geplanter Start</Label>
            <div className="flex gap-2">
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="flex-1 min-w-0 text-sm border border-input rounded-md px-3 py-2 bg-background"
              />
              <input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                disabled={!plannedDate}
                className="w-32 text-sm border border-input rounded-md px-3 py-2 bg-background disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-print-time">Druckzeit (Minuten)</Label>
            <Input
              id="job-print-time"
              type="number"
              placeholder="z.B. 120"
              value={printTimeMinutes}
              onChange={(e) => setPrintTimeMinutes(e.target.value)}
              disabled={job.printTimeFromGcode}
            />
            {job.printTimeFromGcode && (
              <p className="text-xs text-muted-foreground">Aus G-Code extrahiert</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-notes">Notizen</Label>
            <Textarea
              id="job-notes"
              placeholder="Besonderheiten, Einstellungen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <Label>Zugewiesen an</Label>
              <AssigneePicker
                users={teamMembers}
                value={assigneeIds}
                onChange={(ids) => setAssigneeIds(ids)}
              />
            </div>
          )}

          {/* Assigned parts */}
          <div className="space-y-2">
            <Label>Teile</Label>

            {/* Part search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Auftrag suchen, Teile hinzufügen..."
                  value={partSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="text-sm pl-8"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                  {searchResults.map((order) => (
                    <div key={order.id} className="border-b last:border-b-0">
                      <div className="px-3 py-1.5 bg-muted/30">
                        <p className="text-xs font-semibold">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                      </div>
                      {order.parts.map((part) => (
                        <button
                          key={part.id}
                          className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                          disabled={addingPart}
                          onClick={() => handleAddPart(part.id)}
                        >
                          {part.colorHex && (
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: part.colorHex }}
                            />
                          )}
                          <span className="flex-1 truncate">{part.name}</span>
                          {addingPart && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {partSearch.trim() && !searchLoading && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1 px-1">Keine Teile gefunden</p>
              )}
            </div>

            {job.parts.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Teile zugewiesen</p>
            )}
            {job.parts.map((jp) => (
              <div key={jp.orderPartId} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {jp.orderPart.name}
                    {jp.orderPart.quantity > 1 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">× {jp.orderPart.quantity}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {jp.orderPart.order.customerName} · {jp.orderPart.order.customerEmail}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRemovePart(jp.orderPartId)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Filament section */}
          {(job.filamentUsages.length > 0 || partFilaments.length > 0) && (
            <div className="space-y-2">
              <Label>Filament</Label>
              {job.filamentUsages.length > 0 ? (
                job.filamentUsages.map((usage) => {
                  const materialMatch = partFilaments.length === 0 ||
                    partFilaments.some((f) => f?.material === usage.filament.material);
                  return (
                    <div key={usage.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm">
                      {usage.filament.colorHex && (
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: usage.filament.colorHex }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium truncate">{usage.filament.name}</p>
                          {!materialMatch && (
                            <span title="Materialdiskrepanz">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{usage.gramsActual} g (G-Code)</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                partFilaments.map((filament) => (
                  <div key={filament.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm">
                    {filament.colorHex && (
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: filament.colorHex }} />
                    )}
                    <p className="font-medium truncate">{filament.name}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* STL download + Slicing files */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Slicing</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasStlParts || downloadingStl}
                onClick={handleStlDownload}
              >
                {downloadingStl ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-2" />
                )}
                STL-Dateien herunterladen
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasStlParts || downloadingOrca}
                onClick={handle3mfDownload}
              >
                {downloadingOrca ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-2" />
                )}
                OrcaSlicer-Projekt (.3mf)
              </Button>
            </div>

            {sliceFiles.length > 0 && (
              <div className="space-y-1.5">
                {sliceFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.originalName}</p>
                      <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      asChild
                    >
                      <a
                        href={`/api/files/jobs/${job.id}/${f.filename}`}
                        download={f.originalName}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      disabled={deletingFileId === f.id}
                      onClick={() => handleDeleteSliceFile(f.id)}
                    >
                      {deletingFileId === f.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".gcode,.gco,.bgcode,.3mf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSliceFileUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={uploadingFile}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingFile ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-2" />
              )}
              Slicing-Datei hochladen (.gcode, .3mf, …)
            </Button>
          </div>

          {/* Send to printer */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Printer className="h-4 w-4" />
                Drucker
              </Label>
              {printerState && (
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    !printerState.connected
                      ? "bg-muted text-muted-foreground"
                      : printerState.state === "IDLE" || printerState.state === "READY"
                        ? "bg-emerald-100 text-emerald-700"
                        : printerState.state === "PRINTING"
                          ? "bg-amber-100 text-amber-700"
                          : printerState.state === "OFFLINE" || printerState.state == null
                            ? "bg-destructive/10 text-destructive"
                            : "bg-blue-100 text-blue-700"
                  )}
                  data-testid="printer-state-badge"
                >
                  {!printerState.connected
                    ? "Nicht verbunden"
                    : PRINTER_STATE_LABELS[printerState.state ?? ""] ?? "Nicht erreichbar"}
                </span>
              )}
            </div>

            {printerState && !printerState.connected ? (
              <p className="text-xs text-muted-foreground">
                Für diesen Drucker ist keine Cloud-Verbindung konfiguriert. Verbindung
                unter „Maschinen“ einrichten.
              </p>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                disabled={dispatching || sliceFiles.length === 0}
                onClick={handleDispatch}
                data-testid="dispatch-btn"
              >
                {dispatching ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5 mr-2" />
                )}
                An Drucker senden
              </Button>
            )}

            {dispatches.length > 0 && (
              <div className="space-y-1.5" data-testid="dispatch-list">
                {dispatches.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm"
                    data-testid="dispatch-row"
                    data-status={d.status}
                  >
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded font-medium shrink-0",
                        DISPATCH_STATUS_COLORS[d.status]
                      )}
                    >
                      {DISPATCH_STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {d.status === "HELD" && d.holdReason === "bed_occupied"
                        ? "Platte belegt"
                        : d.status === "HELD"
                          ? "Drucker beschäftigt"
                          : d.error
                            ? d.error
                            : (d.printJobFile?.originalName ?? "")}
                    </span>
                    {d.status === "HELD" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0"
                        disabled={startingId === d.id}
                        onClick={() => handleStartHeld(d.id)}
                        data-testid="dispatch-start-btn"
                      >
                        {startingId === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Jetzt starten"
                        )}
                      </Button>
                    )}
                    {["HELD", "STARTED", "PRINTING"].includes(d.status) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleCancelDispatch(d.id)}
                        title="Abbrechen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="flex-row items-center flex-wrap gap-2">
          {["PLANNED", "SLICED", "CANCELLED"].includes(job.status) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Job löschen"
              className="mr-auto h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {job.status === "AWAITING_VERIFICATION" && (
            <Button
              variant="default"
              data-tutorial="druck-verifizieren"
              className="mr-auto bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setVerifyOpen(true)}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Druck verifizieren
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern..." : "Änderungen speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {job.status === "AWAITING_VERIFICATION" && (
        <JobVerificationDialog
          job={job}
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          onVerified={(updatedJob) => {
            onUpdated(updatedJob);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
