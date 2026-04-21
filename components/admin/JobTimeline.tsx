"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PrintJob } from "./JobCard";
import { JobDetailDialog } from "./JobDetailDialog";
import { CreateJobDialog } from "./CreateJobDialog";

interface DragState {
  type: "move" | "resize" | "schedule";
  jobId: string;
  job: PrintJob;
  startClientX: number;
  startClientY: number;
  originalLeft: number;
  originalWidth: number;
  originalMachineIndex: number;
}

interface DragPreview {
  jobId: string;
  left: number;
  width: number;
  machineId: string;
  isOverlapping?: boolean;
}

interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
}

interface JobTimelineProps {
  machines: Machine[];
  jobs: PrintJob[];
  onJobCreated: (job: PrintJob) => void;
  onJobUpdated: (job: PrintJob) => void;
  onJobDeleted: (id: string) => void;
}

type ViewMode = "day" | "week" | "month";

const STATUS_COLOR: Record<PrintJob["status"], string> = {
  PLANNED: "#2563eb",
  SLICED: "#9333ea",
  IN_PROGRESS: "#d97706",
  DONE: "#16a34a",
  CANCELLED: "#6b7280",
};

const STATUS_CHIP: Record<PrintJob["status"], string> = {
  PLANNED: "bg-blue-100 text-blue-700 border-blue-200",
  SLICED: "bg-purple-100 text-purple-700 border-purple-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  DONE: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<PrintJob["status"], string> = {
  PLANNED: "Geplant",
  SLICED: "Gesliced",
  IN_PROGRESS: "Im Druck",
  DONE: "Fertig",
  CANCELLED: "Storniert",
};

import {
  DAY_NAMES_SHORT,
  MONTH_NAMES,
  MONTH_NAMES_LONG,
  DAY_NAMES_LONG,
  toLocalDateString,
  isToday,
} from "@/lib/gantt-utils";
import { getRulerMode } from "@/lib/timeline-ruler";

const MACHINE_COL_W = 160;
const ROW_H = 56;
const RULER_H = 72;
const BAND_H = 22;
const MIN_PX_H = 0.02;
const MAX_PX_H = 150;

// Pixels-per-hour defaults for each preset mode
const DEFAULT_PX_H_BY_VIEW: Record<ViewMode, number> = {
  day: 40,
  week: 16,
  month: 40 / 24, // ~1.667 px/hour ≈ 40 px/day
};

function getSnapMinutes(pxH: number): number {
  if (pxH >= 40) return 15;
  if (pxH >= 20) return 30;
  if (pxH >= 5) return 60;
  return 1440; // 1-day snap
}

function snapToGrid(minutes: number, pxH: number): number {
  const snap = getSnapMinutes(pxH);
  return Math.round(minutes / snap) * snap;
}

function snapPlannedAt(ms: number, pxH: number): Date {
  if (pxH < 5) {
    const d = new Date(ms);
    const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    result.setHours(8, 0, 0, 0);
    return result;
  }
  const snap = getSnapMinutes(pxH);
  const snappedMs = Math.round(ms / (snap * 60_000)) * (snap * 60_000);
  return new Date(snappedMs);
}

function getHourStep(pixelsPerHour: number): number | null {
  if (pixelsPerHour >= 40) return 1;
  if (pixelsPerHour >= 20) return 2;
  if (pixelsPerHour >= 10) return 6;
  if (pixelsPerHour >= 5) return 12;
  return null;
}

export function JobTimeline({ machines, jobs, onJobCreated, onJobUpdated, onJobDeleted }: JobTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [originMs, setOriginMs] = useState(() => Date.now() - 24 * 3_600_000);
  const [pxH, setPxH] = useState(DEFAULT_PX_H_BY_VIEW.week);
  const [containerWidth, setContainerWidth] = useState(0);

  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ machineId: string; date: string; time: string }>({
    machineId: "", date: "", time: "08:00",
  });
  const [mounted, setMounted] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [longPressActiveId, setLongPressActiveId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pixelsPerHourRef = useRef(pxH);
  const originMsRef = useRef(originMs);
  const dragStateRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const hasDraggedRef = useRef(false);
  const machinesRef = useRef(machines);
  const jobsRef = useRef(jobs);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPendingRef = useRef<{
    job: PrintJob;
    machineIndex: number;
    clientX: number;
    clientY: number;
    type: "move" | "resize";
  } | null>(null);
  const panDragRef = useRef<{ startClientX: number; originMsAtStart: number } | null>(null);
  const pinchStateRef = useRef<{
    initialDist: number;
    initialPxH: number;
    midX: number;
    originMsAtStart: number;
  } | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { machinesRef.current = machines; }, [machines]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { pixelsPerHourRef.current = pxH; }, [pxH]);
  useEffect(() => { originMsRef.current = originMs; }, [originMs]);

  // ResizeObserver for container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const contentWidth = Math.max(0, containerWidth - MACHINE_COL_W);

  // Today line: current time as pixel offset from originMs
  const todayLineLeft = mounted
    ? ((Date.now() - originMs) / 3_600_000) * pxH
    : null;
  const showTodayLine = todayLineLeft !== null && todayLineLeft >= 0 && todayLineLeft <= contentWidth;

  // Nav label from visible range
  const navLabel = (() => {
    if (!mounted || contentWidth === 0) return "";
    const visibleEndMs = originMs + (contentWidth / pxH) * 3_600_000;
    const start = new Date(originMs);
    const end = new Date(visibleEndMs);
    const spanDays = (visibleEndMs - originMs) / 86_400_000;
    if (spanDays <= 1.1) {
      return `${DAY_NAMES_LONG[start.getDay()]}, ${start.getDate()}. ${MONTH_NAMES_LONG[start.getMonth()]} ${start.getFullYear()}`;
    }
    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.getDate()}. ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()}. ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${start.getDate()}. ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()}. ${MONTH_NAMES[end.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()}. – ${end.getDate()}. ${MONTH_NAMES_LONG[start.getMonth()]} ${start.getFullYear()}`;
  })();

  function navigate(dir: -1 | 1) {
    const stepMs =
      viewMode === "day" ? 86_400_000 :
      viewMode === "week" ? 7 * 86_400_000 :
      30 * 86_400_000;
    setOriginMs((o) => o + dir * stepMs);
  }

  function goToday() {
    setOriginMs(Date.now() - (contentWidth / pixelsPerHourRef.current / 2) * 3_600_000);
  }

  function resetZoom() {
    const newPxH = DEFAULT_PX_H_BY_VIEW[viewMode];
    setPxH(newPxH);
    pixelsPerHourRef.current = newPxH;
    setOriginMs(Date.now() - (contentWidth / newPxH / 2) * 3_600_000);
  }

  function applyViewPreset(vm: ViewMode) {
    const newPxH = DEFAULT_PX_H_BY_VIEW[vm];
    setViewMode(vm);
    setPxH(newPxH);
    pixelsPerHourRef.current = newPxH;
    setOriginMs(Date.now() - (contentWidth / newPxH / 2) * 3_600_000);
  }

  function getUnscheduledJobs(): PrintJob[] {
    return jobs.filter((j) => !j.plannedAt);
  }

  function handleJobClick(job: PrintJob) {
    setSelectedJob(job);
    setDetailOpen(true);
  }

  function handleJobUpdated(updated: PrintJob) {
    onJobUpdated(updated);
    setSelectedJob(updated);
  }

  function handleJobDeleted(jobId: string) {
    onJobDeleted(jobId);
    setSelectedJob(null);
  }

  // Pixel offset of a plannedAt from originMs (uses refs — safe in callbacks/effects)
  function jobLeftForRef(plannedAt: string): number {
    return ((new Date(plannedAt).getTime() - originMsRef.current) / 3_600_000) * pixelsPerHourRef.current;
  }

  // Pixel offset of a plannedAt from originMs (uses state — safe in render)
  function jobLeft(plannedAt: string): number {
    return ((new Date(plannedAt).getTime() - originMs) / 3_600_000) * pxH;
  }

  function jobBarWidth(printTimeMinutes: number | null): number {
    const minutes = printTimeMinutes ?? 120;
    return Math.max(3, (minutes / 60) * pxH);
  }

  function jobBarWidthRef(printTimeMinutes: number | null): number {
    const minutes = printTimeMinutes ?? 120;
    return Math.max(3, (minutes / 60) * pixelsPerHourRef.current);
  }

  function getMachineJobs(machineId: string): PrintJob[] {
    return jobs.filter((j) => j.machineId === machineId && j.plannedAt != null);
  }

  function handleJobMouseDown(e: React.MouseEvent, job: PrintJob, machineIndex: number) {
    e.stopPropagation();
    e.preventDefault();
    dragStateRef.current = {
      type: "move",
      jobId: job.id,
      job,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalLeft: jobLeft(job.plannedAt!),
      originalWidth: jobBarWidth(job.printTimeMinutes),
      originalMachineIndex: machineIndex,
    };
    hasDraggedRef.current = false;
    dragPreviewRef.current = {
      jobId: job.id,
      left: jobLeft(job.plannedAt!),
      width: jobBarWidth(job.printTimeMinutes),
      machineId: machinesRef.current[machineIndex]?.id ?? job.machineId ?? "",
    };
  }

  function handleResizeMouseDown(e: React.MouseEvent, job: PrintJob, machineIndex: number) {
    e.stopPropagation();
    e.preventDefault();
    dragStateRef.current = {
      type: "resize",
      jobId: job.id,
      job,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalLeft: jobLeft(job.plannedAt!),
      originalWidth: jobBarWidth(job.printTimeMinutes),
      originalMachineIndex: machineIndex,
    };
    hasDraggedRef.current = false;
    dragPreviewRef.current = {
      jobId: job.id,
      left: jobLeft(job.plannedAt!),
      width: jobBarWidth(job.printTimeMinutes),
      machineId: machinesRef.current[machineIndex]?.id ?? job.machineId ?? "",
    };
  }

  function checkClientOverlap(previewLeft: number, previewWidth: number, targetMachineId: string, excludeJobId: string): boolean {
    const machineJobs = jobsRef.current.filter(
      (j) => j.machineId === targetMachineId && j.id !== excludeJobId && j.plannedAt != null
    );
    const pxPerH = pixelsPerHourRef.current;
    for (const j of machineJobs) {
      const jLeft = jobLeftForRef(j.plannedAt!);
      const jWidth = Math.max(pxPerH / 4, ((j.printTimeMinutes ?? 120) / 60) * pxPerH);
      if (previewLeft < jLeft + jWidth && previewLeft + previewWidth > jLeft) {
        return true;
      }
    }
    return false;
  }

  function applyPointerMove(clientX: number, clientY: number) {
    const drag = dragStateRef.current;
    if (!drag) return;
    const dx = clientX - drag.startClientX;
    const dy = clientY - drag.startClientY;
    if (!hasDraggedRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    hasDraggedRef.current = true;

    const pxPerH = pixelsPerHourRef.current;
    let preview: DragPreview;

    if (drag.type === "move" || drag.type === "schedule") {
      let snappedLeft: number;

      if (drag.type === "schedule") {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // Row canvas rect.left is past the sticky sidebar, so just subtract MACHINE_COL_W from container
        const rawLeft = clientX - rect.left - MACHINE_COL_W;
        const rawMs = originMsRef.current + (rawLeft / pxPerH) * 3_600_000;
        const snapped = snapPlannedAt(rawMs, pxPerH);
        snappedLeft = (snapped.getTime() - originMsRef.current) / 3_600_000 * pxPerH;
      } else {
        const rawLeft = drag.originalLeft + dx;
        const rawMs = originMsRef.current + (rawLeft / pxPerH) * 3_600_000;
        const snapped = snapPlannedAt(rawMs, pxPerH);
        snappedLeft = (snapped.getTime() - originMsRef.current) / 3_600_000 * pxPerH;
      }

      // Determine target machine by Y position
      const container = containerRef.current;
      let targetMachineId = machinesRef.current[drag.originalMachineIndex]?.id ?? drag.job.machineId ?? "";
      if (container) {
        const rect = container.getBoundingClientRect();
        const relY = clientY - rect.top + container.scrollTop - RULER_H;
        const rowIdx = Math.floor(relY / ROW_H);
        if (rowIdx >= 0 && rowIdx < machinesRef.current.length) {
          targetMachineId = machinesRef.current[rowIdx].id;
        }
      }

      const isOverlapping = checkClientOverlap(snappedLeft, drag.originalWidth, targetMachineId, drag.jobId);
      preview = { jobId: drag.jobId, left: snappedLeft, width: drag.originalWidth, machineId: targetMachineId, isOverlapping };
    } else {
      const rawWidth = Math.max(pxPerH / 4, drag.originalWidth + dx);
      const rawMinutes = (rawWidth / pxPerH) * 60;
      const snappedMinutes = snapToGrid(rawMinutes, pxPerH);
      const snappedWidth = Math.max(pxPerH / 4, (snappedMinutes / 60) * pxPerH);
      const targetMachineId = machinesRef.current[drag.originalMachineIndex]?.id ?? drag.job.machineId ?? "";
      const isOverlapping = checkClientOverlap(drag.originalLeft, snappedWidth, targetMachineId, drag.jobId);
      preview = { jobId: drag.jobId, left: drag.originalLeft, width: snappedWidth, machineId: targetMachineId, isOverlapping };
    }

    dragPreviewRef.current = preview;
    setDragPreview({ ...preview });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (panDragRef.current && !dragStateRef.current) {
      const dx = e.clientX - panDragRef.current.startClientX;
      if (Math.abs(dx) > 5) hasDraggedRef.current = true;
      const newOriginMs = panDragRef.current.originMsAtStart - (dx / pixelsPerHourRef.current) * 3_600_000;
      originMsRef.current = newOriginMs;
      setOriginMs(newOriginMs);
      return;
    }
    applyPointerMove(e.clientX, e.clientY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseUp = useCallback(() => {
    panDragRef.current = null;
    const drag = dragStateRef.current;
    const preview = dragPreviewRef.current;
    dragStateRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (!drag || !hasDraggedRef.current || !preview) return;

    if (preview.isOverlapping) {
      toast.error("Überschneidung mit einem anderen Druckauftrag");
      return;
    }

    const pxPerH = pixelsPerHourRef.current;

    if (drag.type === "move" || drag.type === "schedule") {
      const newPlannedAt = new Date(originMsRef.current + (preview.left / pxPerH) * 3_600_000);
      const body: Record<string, unknown> = { plannedAt: newPlannedAt.toISOString() };
      if (preview.machineId !== drag.job.machineId || drag.type === "schedule") {
        body.machineId = preview.machineId;
      }
      fetch(`/api/admin/jobs/${drag.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (r) => {
          if (r.status === 409) {
            toast.error("Überschneidung mit einem anderen Druckauftrag");
            return;
          }
          const { job }: { job: PrintJob } = await r.json();
          onJobUpdated(job);
        })
        .catch(console.error);
    } else {
      const newMinutes = Math.round((preview.width / pxPerH) * 60);
      fetch(`/api/admin/jobs/${drag.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printTimeMinutes: newMinutes }),
      })
        .then(async (r) => {
          if (r.status === 409) {
            toast.error("Überschneidung mit einem anderen Druckauftrag");
            return;
          }
          const { job }: { job: PrintJob } = await r.json();
          onJobUpdated(job);
        })
        .catch(console.error);
    }
  }, [onJobUpdated]);

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPendingRef.current = null;
    setLongPressActiveId(null);
  }

  function handleJobTouchStart(
    e: React.TouchEvent,
    job: PrintJob,
    machineIndex: number,
    type: "move" | "resize"
  ) {
    e.stopPropagation();
    const t = e.touches[0];
    if (!t) return;

    longPressPendingRef.current = { job, machineIndex, clientX: t.clientX, clientY: t.clientY, type };

    longPressTimerRef.current = setTimeout(() => {
      setLongPressActiveId(job.id);
      longPressTimerRef.current = setTimeout(() => {
        const p = longPressPendingRef.current;
        if (!p) return;
        dragStateRef.current = {
          type: p.type,
          jobId: p.job.id,
          job: p.job,
          startClientX: p.clientX,
          startClientY: p.clientY,
          originalLeft: jobLeftForRef(p.job.plannedAt!),
          originalWidth: jobBarWidthRef(p.job.printTimeMinutes),
          originalMachineIndex: p.machineIndex,
        };
        hasDraggedRef.current = false;
        dragPreviewRef.current = {
          jobId: p.job.id,
          left: jobLeftForRef(p.job.plannedAt!),
          width: jobBarWidthRef(p.job.printTimeMinutes),
          machineId: machinesRef.current[p.machineIndex]?.id ?? p.job.machineId ?? "",
        };
        longPressPendingRef.current = null;
        setLongPressActiveId(null);
      }, 100);
    }, 150);
  }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Two-finger pinch zoom
    if (e.touches.length === 2 && pinchStateRef.current) {
      e.preventDefault();
      const ps = pinchStateRef.current;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / ps.initialDist;
      const newPxH = Math.min(MAX_PX_H, Math.max(MIN_PX_H, ps.initialPxH * ratio));
      const cursorTimeMs = ps.originMsAtStart + (ps.midX / ps.initialPxH) * 3_600_000;
      const newOriginMs = cursorTimeMs - (ps.midX / newPxH) * 3_600_000;
      originMsRef.current = newOriginMs;
      pixelsPerHourRef.current = newPxH;
      setOriginMs(newOriginMs);
      setPxH(newPxH);
      return;
    }

    // If long-press pending and finger moved > 8px, cancel it
    if (longPressPendingRef.current) {
      const t = e.touches[0];
      if (t) {
        const dx = t.clientX - longPressPendingRef.current.clientX;
        const dy = t.clientY - longPressPendingRef.current.clientY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          clearLongPress();
          return;
        }
      }
      return;
    }

    // Background pan (one finger, no job drag active)
    if (e.touches.length === 1 && panDragRef.current && !dragStateRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panDragRef.current.startClientX;
      const newOriginMs = panDragRef.current.originMsAtStart - (dx / pixelsPerHourRef.current) * 3_600_000;
      originMsRef.current = newOriginMs;
      setOriginMs(newOriginMs);
      return;
    }

    if (!dragStateRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) applyPointerMove(t.clientX, t.clientY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStateRef.current = null;
    panDragRef.current = null;
    clearLongPress();
    handleMouseUp();
  }, [handleMouseUp]);

  const handleTouchCancel = useCallback(() => {
    clearLongPress();
    dragStateRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchCancel);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  useEffect(() => {
    if (!dragPreview) {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    } else {
      const drag = dragStateRef.current;
      document.body.style.cursor = drag?.type === "resize" ? "ew-resize" : "grabbing";
      document.body.style.userSelect = "none";
    }
  }, [dragPreview]);

  function handleUnscheduledMouseDown(e: React.MouseEvent, job: PrintJob) {
    e.preventDefault();
    const machineIdx = machinesRef.current.findIndex((m) => m.id === job.machineId);
    dragStateRef.current = {
      type: "schedule",
      jobId: job.id,
      job,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalLeft: 0,
      originalWidth: jobBarWidth(job.printTimeMinutes),
      originalMachineIndex: machineIdx >= 0 ? machineIdx : 0,
    };
    hasDraggedRef.current = false;
    dragPreviewRef.current = null;
  }

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>, machineId: string) {
    if (hasDraggedRef.current) { hasDraggedRef.current = false; return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = originMsRef.current + (x / pixelsPerHourRef.current) * 3_600_000;
    const clickedDate = snapPlannedAt(ms, pixelsPerHourRef.current);
    setCreateDefaults({
      machineId,
      date: toLocalDateString(clickedDate),
      time: `${String(clickedDate.getHours()).padStart(2, "0")}:${String(clickedDate.getMinutes()).padStart(2, "0")}`,
    });
    setCreateOpen(true);
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const oldPxH = pixelsPerHourRef.current;
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newPxH = Math.min(MAX_PX_H, Math.max(MIN_PX_H, oldPxH * factor));
    if (newPxH === oldPxH) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - MACHINE_COL_W;
    const cursorTimeMs = originMsRef.current + (mouseX / oldPxH) * 3_600_000;
    const newOriginMs = cursorTimeMs - (mouseX / newPxH) * 3_600_000;

    originMsRef.current = newOriginMs;
    pixelsPerHourRef.current = newPxH;
    setOriginMs(newOriginMs);
    setPxH(newPxH);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Ruler rendering ──────────────────────────────────────────────────────────

  function renderDayCells(topOffset: number, cellHeight: number) {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const endMs = originMs + contentWidth * msPerPxD;
    const d0 = new Date(originMs);
    let cur = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
    const cells: React.ReactNode[] = [];
    while (cur.getTime() <= endMs + 86_400_000) {
      const x = (cur.getTime() - originMs) / msPerPxD;
      const day = new Date(cur);
      const isT = isToday(day);
      cells.push(
        <div
          key={cur.getTime()}
          className={cn(
            "absolute flex flex-col items-center justify-center border-r text-[10px]",
            isT ? "text-primary font-bold" : "text-muted-foreground"
          )}
          style={{ left: x, width: pxD, top: topOffset, height: cellHeight }}
        >
          {pxD >= 16 && (
            <>
              {pxD >= 28 && <span className="leading-none">{DAY_NAMES_SHORT[day.getDay()]}</span>}
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                isT ? "bg-primary text-primary-foreground" : ""
              )}>
                {day.getDate()}
              </span>
            </>
          )}
          {pxD < 16 && pxD >= 4 && day.getDate() === 1 && (
            <span className="text-[9px] leading-none">{day.getDate()}</span>
          )}
        </div>
      );
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }

  function renderMonthBand(top: number, height: number) {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const endMs = originMs + contentWidth * msPerPxD;
    const cells: React.ReactNode[] = [];
    const d0 = new Date(originMs);
    let cur = new Date(d0.getFullYear(), d0.getMonth(), 1);
    while (cur.getTime() <= endMs) {
      const monthStart = cur.getTime();
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const monthEnd = Math.min(nextMonth.getTime(), endMs + 86_400_000);
      const x = Math.max(0, (monthStart - originMs) / msPerPxD);
      const w = (monthEnd - Math.max(monthStart, originMs)) / msPerPxD;
      const label = w > 50
        ? `${MONTH_NAMES_LONG[cur.getMonth()]} ${cur.getFullYear()}`
        : w > 25 ? MONTH_NAMES[cur.getMonth()]
        : "";
      cells.push(
        <div key={monthStart} className="absolute border-r text-[10px] font-semibold text-foreground overflow-hidden flex items-center px-1.5" style={{ left: x, width: w, top, height }}>
          {label}
        </div>
      );
      cur = nextMonth;
    }
    return cells;
  }

  function renderYearBand(top: number, height: number) {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const endMs = originMs + contentWidth * msPerPxD;
    const cells: React.ReactNode[] = [];
    let year = new Date(originMs).getFullYear() - 1;
    while (new Date(year, 0, 1).getTime() <= endMs) {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year + 1, 0, 1).getTime();
      const x = Math.max(0, (yearStart - originMs) / msPerPxD);
      const w = (Math.min(yearEnd, endMs + 86_400_000) - Math.max(yearStart, originMs)) / msPerPxD;
      if (w > 0) {
        cells.push(
          <div key={year} className="absolute border-r text-[10px] font-bold text-foreground overflow-hidden flex items-center px-1.5" style={{ left: x, width: w, top, height }}>
            {w > 25 ? String(year) : ""}
          </div>
        );
      }
      year++;
    }
    return cells;
  }

  function renderMonthCells(top: number, height: number) {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const endMs = originMs + contentWidth * msPerPxD;
    const cells: React.ReactNode[] = [];
    const d0 = new Date(originMs);
    let cur = new Date(d0.getFullYear(), d0.getMonth(), 1);
    while (cur.getTime() <= endMs) {
      const monthStart = cur.getTime();
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const x = (monthStart - originMs) / msPerPxD;
      const w = (nextMonth.getTime() - monthStart) / msPerPxD;
      const label = w > 60 ? MONTH_NAMES[cur.getMonth()] : w > 20 ? MONTH_NAMES[cur.getMonth()][0] : "";
      cells.push(
        <div key={monthStart} className={cn("absolute border-r text-[10px] font-medium overflow-hidden flex items-center justify-center", isToday(cur) ? "text-primary" : "text-muted-foreground")} style={{ left: x, width: w, top, height }}>
          {label}
        </div>
      );
      cur = nextMonth;
    }
    return cells;
  }

  function renderRulerColumns() {
    if (contentWidth === 0) return null;
    const pxD = pxH * 24;
    const rulerMode = getRulerMode(pxD);
    const msPerPxH = 3_600_000 / pxH;
    const endMs = originMs + contentWidth * msPerPxH;
    const hourStep = getHourStep(pxH);

    if (rulerMode === "days") {
      // Day cells + optional hour ticks
      const d0 = new Date(originMs);
      const firstDay = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
      const dayCells: React.ReactNode[] = [];
      let cur = new Date(firstDay);
      while (cur.getTime() <= endMs + 86_400_000) {
        const x = (cur.getTime() - originMs) / (3_600_000 / pxH);
        const dayWidth = 24 * pxH;
        const day = new Date(cur);
        const isT = isToday(day);
        dayCells.push(
          <div
            key={cur.getTime()}
            className={cn(
              "absolute flex flex-col items-center justify-start pt-1.5 border-r text-xs font-medium",
              isT ? "text-primary" : "text-muted-foreground"
            )}
            style={{ left: x, width: dayWidth, height: RULER_H }}
          >
            <span className="text-[10px] uppercase tracking-wide leading-none">
              {DAY_NAMES_SHORT[day.getDay()]}
            </span>
            <span className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold leading-tight mt-0.5",
              isT ? "bg-primary text-primary-foreground" : "text-foreground"
            )}>
              {day.getDate()}
            </span>
          </div>
        );
        cur.setDate(cur.getDate() + 1);
      }

      const hourTicks: React.ReactNode[] = [];
      if (hourStep !== null) {
        const startHourMs = Math.ceil(originMs / (hourStep * 3_600_000)) * (hourStep * 3_600_000);
        for (let t = startHourMs; t <= endMs + 3_600_000; t += hourStep * 3_600_000) {
          const hourOfDay = new Date(t).getHours();
          if (hourOfDay === 0) continue;
          const tickLeft = (t - originMs) / (3_600_000 / pxH);
          hourTicks.push(
            <div key={t} className="absolute bottom-0 flex flex-col items-center" style={{ left: tickLeft, transform: "translateX(-50%)" }}>
              <span className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">
                {String(hourOfDay).padStart(2, "0")}
              </span>
              <div className="h-2 w-px bg-border/60" />
            </div>
          );
        }
      }

      return <>{dayCells}{hourTicks}</>;
    }

    if (rulerMode === "days-band") {
      return (
        <>
          {renderMonthBand(0, BAND_H)}
          {renderDayCells(BAND_H, RULER_H - BAND_H)}
        </>
      );
    }

    // months-band: year on top, month cells below
    return (
      <>
        {renderYearBand(0, BAND_H)}
        {renderMonthCells(BAND_H, RULER_H - BAND_H)}
      </>
    );
  }

  function renderGridLines() {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const endMs = originMs + contentWidth * msPerPxD;
    const d0 = new Date(originMs);
    const firstMidnight = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
    const lines: number[] = [];
    for (let t = firstMidnight; t <= endMs + 86_400_000; t += 86_400_000) {
      const x = (t - originMs) / msPerPxD;
      if (x >= -1) lines.push(x);
    }
    return lines.map((x, i) => (
      <div key={i} className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none" style={{ left: x }} />
    ));
  }

  function renderTodayHighlight() {
    const pxD = pxH * 24;
    const msPerPxD = 86_400_000 / pxD;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const x = (todayStart - originMs) / msPerPxD;
    if (x < -pxD || x > contentWidth) return null;
    return (
      <div className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none" style={{ left: x, width: pxD }} />
    );
  }

  const unscheduled = getUnscheduledJobs();

  return (
    <>
      {/* Navigation header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-background flex-shrink-0 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[220px] text-center" data-testid="timeline-nav-label">{navLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Vor" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={goToday}>
          Heute
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* View preset buttons */}
        <div className="flex items-center rounded-md border overflow-hidden">
          {(["day", "week", "month"] as ViewMode[]).map((vm) => (
            <button
              key={vm}
              onClick={() => applyViewPreset(vm)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                viewMode === vm
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {vm === "day" ? "Tag" : vm === "week" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={resetZoom}
          title="Zoom zurücksetzen"
        >
          1:1
        </Button>
      </div>

      {/* Gantt container — no horizontal scrollbar */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-hidden overflow-y-auto relative"
        style={{ cursor: "default" }}
        onMouseDown={(e) => {
          if (e.button !== 0 || dragStateRef.current) return;
          panDragRef.current = { startClientX: e.clientX, originMsAtStart: originMsRef.current };
          hasDraggedRef.current = false;
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.hypot(dx, dy);
            const rect = containerRef.current?.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
              - (rect?.left ?? 0) - MACHINE_COL_W;
            pinchStateRef.current = {
              initialDist: dist,
              initialPxH: pixelsPerHourRef.current,
              midX,
              originMsAtStart: originMsRef.current,
            };
            panDragRef.current = null;
          } else if (e.touches.length === 1 && !dragStateRef.current) {
            panDragRef.current = {
              startClientX: e.touches[0].clientX,
              originMsAtStart: originMsRef.current,
            };
          }
        }}
      >
        <div style={{ minWidth: "100%" }}>

          {/* Sticky ruler */}
          <div
            className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b flex"
            style={{ height: RULER_H }}
          >
            {/* Machine column header */}
            <div
              className="sticky left-0 z-30 bg-muted/80 backdrop-blur-sm border-r flex items-center px-3 text-xs font-medium text-muted-foreground flex-shrink-0"
              style={{ width: MACHINE_COL_W, minWidth: MACHINE_COL_W }}
            >
              Maschine
            </div>

            {/* Ruler canvas */}
            <div className="relative flex-1 overflow-hidden">
              {renderRulerColumns()}

              {/* Today line in ruler */}
              {showTodayLine && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none"
                  style={{ left: todayLineLeft }}
                />
              )}
            </div>
          </div>

          {/* Machine rows */}
          {machines.map((machine) => {
            const machineJobs = getMachineJobs(machine.id);
            const machineIndex = machines.indexOf(machine);
            return (
              <div key={machine.id} className="flex border-b hover:bg-muted/10 group" style={{ height: ROW_H }}>
                {/* Machine label — sticky left */}
                <div
                  className="sticky left-0 z-10 bg-background border-r flex items-center px-3 text-sm font-medium flex-shrink-0 group-hover:bg-muted/10"
                  style={{ width: MACHINE_COL_W, minWidth: MACHINE_COL_W }}
                >
                  {machine.name}
                </div>

                {/* Row canvas — flex-1, infinite */}
                <div
                  className="relative flex-1 cursor-crosshair overflow-hidden"
                  onClick={(e) => handleRowClick(e, machine.id)}
                >
                  {renderGridLines()}
                  {renderTodayHighlight()}

                  {/* Today line */}
                  {showTodayLine && (
                    <div
                      data-testid="timeline-today-line"
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-10"
                      style={{ left: todayLineLeft }}
                    />
                  )}

                  {/* Job bars */}
                  {machineJobs.map((job) => {
                    const left = jobLeft(job.plannedAt!);
                    const width = jobBarWidth(job.printTimeMinutes);
                    if (left + width < 0 || left > contentWidth) return null;
                    const customerName = job.parts[0]?.orderPart.order.customerName ?? STATUS_LABELS[job.status];
                    const durationLabel = job.printTimeMinutes
                      ? ` (${(job.printTimeMinutes / 60).toFixed(1)}h)`
                      : "";
                    const isBeingDragged = dragPreview?.jobId === job.id;
                    const isLongPressActive = longPressActiveId === job.id;
                    const statusColor = STATUS_COLOR[job.status];
                    return (
                      <div
                        key={job.id}
                        className={cn(
                          "absolute top-1.5 bottom-1.5 rounded-md shadow-sm px-2 text-xs font-medium truncate hover:z-20 select-none transition-transform",
                          isBeingDragged ? "opacity-30" : "hover:brightness-95",
                          isLongPressActive ? "ring-2 ring-primary scale-105" : ""
                        )}
                        style={{
                          left,
                          width,
                          cursor: "grab",
                          touchAction: "none",
                          backgroundColor: statusColor + "33",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderColor: statusColor,
                          color: statusColor,
                        }}
                        title={`${customerName} — ${job.printTimeMinutes ? job.printTimeMinutes + " min" : "Dauer unbekannt"}`}
                        onMouseDown={(e) => handleJobMouseDown(e, job, machineIndex)}
                        onTouchStart={(e) => handleJobTouchStart(e, job, machineIndex, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasDraggedRef.current) handleJobClick(job);
                          hasDraggedRef.current = false;
                        }}
                      >
                        {width > 60 && customerName}
                        {width > 80 && durationLabel}
                        {/* Resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px opacity-0 hover:opacity-100 transition-opacity rounded-r-md"
                          style={{ backgroundColor: statusColor + "44", touchAction: "none" }}
                          onMouseDown={(e) => handleResizeMouseDown(e, job, machineIndex)}
                          onTouchStart={(e) => handleJobTouchStart(e, job, machineIndex, "resize")}
                        >
                          <div className="w-px h-3 rounded-full" style={{ backgroundColor: statusColor }} />
                          <div className="w-px h-3 rounded-full" style={{ backgroundColor: statusColor }} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Drag preview bar */}
                  {dragPreview && dragPreview.machineId === machine.id && (() => {
                    const draggedJob = jobs.find((j) => j.id === dragPreview.jobId);
                    if (!draggedJob) return null;
                    const previewColor = dragPreview.isOverlapping ? "#ef4444" : STATUS_COLOR[draggedJob.status];
                    return (
                      <div
                        className="absolute top-1.5 bottom-1.5 rounded-md border-2 border-dashed pointer-events-none z-20 opacity-80"
                        style={{
                          left: dragPreview.left,
                          width: dragPreview.width,
                          backgroundColor: previewColor + "33",
                          borderColor: previewColor,
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unscheduled jobs strip */}
        {unscheduled.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/30">
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground shrink-0 pt-0.5">
                Nicht geplant:
              </span>
              {unscheduled.map((job) => (
                <button
                  key={job.id}
                  onMouseDown={(e) => handleUnscheduledMouseDown(e, job)}
                  onClick={() => { if (!hasDraggedRef.current) handleJobClick(job); }}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-md border font-medium transition-opacity hover:opacity-80 cursor-grab active:cursor-grabbing",
                    STATUS_CHIP[job.status]
                  )}
                  title="Auf die Timeline ziehen zum Planen"
                >
                  {job.machine.name}
                  {job.parts.length > 0 && ` — ${job.parts[0].orderPart.order.customerName}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <JobDetailDialog
        job={selectedJob}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleJobUpdated}
        onDeleted={handleJobDeleted}
      />

      <CreateJobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        machines={machines}
        defaultMachineId={createDefaults.machineId}
        defaultDate={createDefaults.date}
        defaultTime={createDefaults.time}
        onCreated={(job) => {
          onJobCreated(job);
          setSelectedJob(job);
          setDetailOpen(true);
        }}
      />
    </>
  );
}
