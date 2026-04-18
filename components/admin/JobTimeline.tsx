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
  getMondayOfWeek,
  getWeekDays,
  isSameLocalDay,
  toLocalDateString,
  isToday,
} from "@/lib/gantt-utils";

const MACHINE_COL_W = 160;
const ROW_H = 56;
const RULER_H = 72;
const MIN_PX_H = 4;
const MAX_PX_H = 150;
const MIN_PX_DAY = 20;
const DEFAULT_PX_H = 16;

function getSnapMinutes(pxH: number): number {
  if (pxH >= 40) return 15;
  if (pxH >= 20) return 30;
  return 60;
}

function snapToGrid(minutes: number, pxH: number): number {
  const snap = getSnapMinutes(pxH);
  return Math.round(minutes / snap) * snap;
}

function getHourStep(pixelsPerHour: number): number | null {
  if (pixelsPerHour >= 40) return 1;
  if (pixelsPerHour >= 20) return 2;
  if (pixelsPerHour >= 10) return 6;
  if (pixelsPerHour >= 5) return 12;
  return null;
}

function getTotalWidth(viewMode: ViewMode, pxH: number, daysInMonth: number): number {
  if (viewMode === "day") return 24 * pxH;
  if (viewMode === "month") return daysInMonth * pxH;
  return 7 * 24 * pxH;
}

export function JobTimeline({ machines, jobs, onJobCreated, onJobUpdated, onJobDeleted }: JobTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [zoomByView, setZoomByView] = useState<Record<ViewMode, number>>({
    day: DEFAULT_PX_H,
    week: DEFAULT_PX_H,
    month: 40,
  });

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
  const pixelsPerHourRef = useRef(DEFAULT_PX_H);
  const dragStateRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const hasDraggedRef = useRef(false);
  const viewModeRef = useRef<ViewMode>("week");
  const viewStartRef = useRef<Date>(getMondayOfWeek(new Date()));
  const totalWidthRef = useRef(0);
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

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { machinesRef.current = machines; }, [machines]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Derived values
  const pxH = zoomByView[viewMode];
  const weekStart = getMondayOfWeek(viewDate);
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const totalWidth = getTotalWidth(viewMode, pxH, daysInMonth);

  // Sync refs
  useEffect(() => {
    pixelsPerHourRef.current = pxH;
  }, [pxH]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "week") viewStartRef.current = weekStart;
    else if (viewMode === "day") {
      const d = new Date(viewDate);
      d.setHours(0, 0, 0, 0);
      viewStartRef.current = d;
    } else {
      viewStartRef.current = monthStart;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, viewDate]);

  useEffect(() => {
    totalWidthRef.current = totalWidth;
  }, [totalWidth]);

  // Day view: the single day
  const dayViewDate = new Date(viewDate);
  dayViewDate.setHours(0, 0, 0, 0);

  // Week view days
  const days = getWeekDays(weekStart);

  // Navigation label
  const sunday = days[6];
  let navLabel = "";
  if (viewMode === "day") {
    navLabel = `${DAY_NAMES_LONG[viewDate.getDay()]}, ${viewDate.getDate()}. ${MONTH_NAMES_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  } else if (viewMode === "week") {
    navLabel =
      weekStart.getMonth() === sunday.getMonth()
        ? `${weekStart.getDate()}. – ${sunday.getDate()}. ${MONTH_NAMES_LONG[weekStart.getMonth()]} ${weekStart.getFullYear()}`
        : `${weekStart.getDate()}. ${MONTH_NAMES[weekStart.getMonth()]} – ${sunday.getDate()}. ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
  } else {
    navLabel = `${MONTH_NAMES_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  }

  function navigate(dir: -1 | 1) {
    setViewDate((d) => {
      const next = new Date(d);
      if (viewMode === "day") next.setDate(next.getDate() + dir);
      else if (viewMode === "week") next.setDate(next.getDate() + dir * 7);
      else next.setMonth(next.getMonth() + dir);
      return next;
    });
  }

  function goToday() {
    setViewDate(new Date());
  }

  function resetZoom() {
    setZoomByView((z) => ({ ...z, [viewMode]: viewMode === "month" ? 40 : DEFAULT_PX_H }));
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

  function jobLeftForView(plannedAt: string): number {
    const vm = viewModeRef.current;
    const pxPerH = pixelsPerHourRef.current;
    if (vm === "month") {
      const jobDate = new Date(plannedAt);
      const ms = viewStartRef.current;
      const localMidnight = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate());
      const dayIdx = Math.round((localMidnight.getTime() - ms.getTime()) / 86_400_000);
      return dayIdx * pxPerH;
    }
    const diffMs = new Date(plannedAt).getTime() - viewStartRef.current.getTime();
    return (diffMs / 3_600_000) * pxPerH;
  }

  function jobLeft(plannedAt: string): number {
    const vm = viewMode;
    if (vm === "month") {
      const jobDate = new Date(plannedAt);
      const localMidnight = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate());
      const dayIdx = Math.round((localMidnight.getTime() - monthStart.getTime()) / 86_400_000);
      return dayIdx * pxH;
    }
    const start = vm === "week" ? weekStart : dayViewDate;
    const diffMs = new Date(plannedAt).getTime() - start.getTime();
    return (diffMs / 3_600_000) * pxH;
  }

  function jobBarWidth(printTimeMinutes: number | null): number {
    if (viewMode === "month") {
      const minutes = printTimeMinutes ?? 120;
      const durationDays = minutes / (24 * 60);
      return Math.max(pxH * 0.9, durationDays * pxH);
    }
    const minutes = printTimeMinutes ?? 120;
    return Math.max(8, (minutes / 60) * pxH);
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
      const jLeft = jobLeftForView(j.plannedAt!);
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
    const totalW = totalWidthRef.current;
    let preview: DragPreview;

    if (drag.type === "move" || drag.type === "schedule") {
      let snappedLeft: number;

      if (drag.type === "schedule") {
        // For unscheduled: compute absolute position from cursor, not delta
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const rawLeft = clientX - rect.left + container.scrollLeft - MACHINE_COL_W;
        const clampedLeft = Math.max(0, Math.min(totalW - drag.originalWidth, rawLeft));
        if (viewModeRef.current === "month") {
          const dayIdx = Math.round(clampedLeft / pxPerH);
          snappedLeft = dayIdx * pxPerH;
        } else {
          const rawMinutes = (clampedLeft / pxPerH) * 60;
          const snappedMinutes = snapToGrid(rawMinutes, pxPerH);
          snappedLeft = (snappedMinutes / 60) * pxPerH;
        }
      } else {
        const rawLeft = drag.originalLeft + dx;
        const clampedLeft = Math.max(0, Math.min(totalW - drag.originalWidth, rawLeft));
        if (viewModeRef.current === "month") {
          const dayIdx = Math.round(clampedLeft / pxPerH);
          snappedLeft = dayIdx * pxPerH;
        } else {
          const rawMinutes = (clampedLeft / pxPerH) * 60;
          const snappedMinutes = snapToGrid(rawMinutes, pxPerH);
          snappedLeft = (snappedMinutes / 60) * pxPerH;
        }
      }

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
      preview = {
        jobId: drag.jobId,
        left: drag.originalLeft,
        width: snappedWidth,
        machineId: targetMachineId,
        isOverlapping,
      };
    }

    dragPreviewRef.current = preview;
    setDragPreview({ ...preview });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseMove = useCallback((e: MouseEvent) => {
    applyPointerMove(e.clientX, e.clientY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseUp = useCallback(() => {
    const drag = dragStateRef.current;
    const preview = dragPreviewRef.current;
    dragStateRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (!drag || !hasDraggedRef.current || !preview) return;

    // Don't submit if client-side overlap already detected
    if (preview.isOverlapping) {
      toast.error("Überschneidung mit einem anderen Druckauftrag");
      return;
    }

    const pxPerH = pixelsPerHourRef.current;

    if (drag.type === "move" || drag.type === "schedule") {
      let newPlannedAt: Date;
      if (viewModeRef.current === "month") {
        const dayIdx = Math.round(preview.left / pxPerH);
        newPlannedAt = new Date(viewStartRef.current);
        newPlannedAt.setDate(newPlannedAt.getDate() + dayIdx);
        newPlannedAt.setHours(8, 0, 0, 0);
      } else {
        newPlannedAt = new Date(viewStartRef.current.getTime() + (preview.left / pxPerH) * 3_600_000);
      }
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

    longPressPendingRef.current = {
      job,
      machineIndex,
      clientX: t.clientX,
      clientY: t.clientY,
      type,
    };

    // Visual feedback at 150ms, activate at 250ms
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
          originalLeft: jobLeftForView(p.job.plannedAt!),
          originalWidth: jobBarWidth(p.job.printTimeMinutes),
          originalMachineIndex: p.machineIndex,
        };
        hasDraggedRef.current = false;
        dragPreviewRef.current = {
          jobId: p.job.id,
          left: jobLeftForView(p.job.plannedAt!),
          width: jobBarWidth(p.job.printTimeMinutes),
          machineId: machinesRef.current[p.machineIndex]?.id ?? p.job.machineId ?? "",
        };
        longPressPendingRef.current = null;
        setLongPressActiveId(null);
      }, 100);
    }, 150);
  }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // If long-press pending and finger moved > 8px, cancel long-press (allow scroll)
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
      return; // still waiting for long-press, don't scroll or drag
    }
    if (!dragStateRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) applyPointerMove(t.clientX, t.clientY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTouchEnd = useCallback(() => {
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
    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let clickedDate: Date;
    if (viewMode === "month") {
      const dayIdx = Math.floor(x / pxH);
      clickedDate = new Date(monthStart);
      clickedDate.setDate(clickedDate.getDate() + dayIdx);
      clickedDate.setHours(8, 0, 0, 0);
    } else {
      const start = viewMode === "week" ? weekStart : dayViewDate;
      const clickedMs = start.getTime() + (x / pxH) * 3_600_000;
      clickedDate = new Date(clickedMs);
      clickedDate.setMinutes(0, 0, 0);
    }

    setCreateDefaults({
      machineId,
      date: toLocalDateString(clickedDate),
      time: `${String(clickedDate.getHours()).padStart(2, "0")}:00`,
    });
    setCreateOpen(true);
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    // Only zoom on Ctrl/Cmd+wheel; let plain scroll pan natively
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const vm = viewModeRef.current;
    const oldPxH = pixelsPerHourRef.current;
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const minPx = vm === "month" ? MIN_PX_DAY : MIN_PX_H;
    const newPxH = Math.min(MAX_PX_H, Math.max(minPx, oldPxH * factor));
    if (newPxH === oldPxH) return;

    const mouseX = e.clientX - container.getBoundingClientRect().left;
    const contentX = mouseX + container.scrollLeft - MACHINE_COL_W;
    const newScrollLeft = (contentX / oldPxH) * newPxH - mouseX + MACHINE_COL_W;
    container.scrollLeft = Math.max(0, newScrollLeft);

    setZoomByView((z) => ({ ...z, [vm]: newPxH }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Today line position
  const todayLineLeft = mounted
    ? viewMode === "month"
      ? (() => {
          const now = new Date();
          const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dayIdx = (localMidnight.getTime() - monthStart.getTime()) / 86_400_000;
          return dayIdx * pxH + pxH / 2;
        })()
      : (() => {
          const start = viewMode === "week" ? weekStart : dayViewDate;
          return ((new Date().getTime() - start.getTime()) / 3_600_000) * pxH;
        })()
    : null;
  const showTodayLine = todayLineLeft !== null && todayLineLeft >= 0 && todayLineLeft <= totalWidth;

  // Hour ticks (day/week only)
  const hourStep = viewMode !== "month" ? getHourStep(pxH) : null;
  const spanDays = viewMode === "day" ? 1 : 7;
  const hourTicks: number[] = [];
  if (hourStep !== null) {
    for (let h = 0; h <= spanDays * 24; h += hourStep) {
      hourTicks.push(h);
    }
  }

  // Month view: array of days
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Ruler columns for current view
  function renderRulerColumns() {
    if (viewMode === "month") {
      return monthDays.map((day, i) => {
        const dayWidth = pxH;
        return (
          <div
            key={i}
            className={cn(
              "absolute top-0 flex flex-col items-center justify-start pt-1.5 border-r text-xs font-medium",
              isToday(day) ? "text-primary" : "text-muted-foreground"
            )}
            style={{ left: i * dayWidth, width: dayWidth, height: RULER_H }}
          >
            {dayWidth >= 28 && (
              <span className="text-[10px] leading-none">{DAY_NAMES_SHORT[day.getDay()]}</span>
            )}
            <span className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5",
              isToday(day) ? "bg-primary text-primary-foreground" : ""
            )}>
              {day.getDate()}
            </span>
          </div>
        );
      });
    }

    // Day or week view
    const viewDays = viewMode === "day" ? [dayViewDate] : days;
    return viewDays.map((day, i) => {
      const dayLeft = i * 24 * pxH;
      const dayWidth = 24 * pxH;
      return (
        <div
          key={i}
          className={cn(
            "absolute top-0 flex flex-col items-center justify-start pt-1.5 border-r text-xs font-medium",
            isToday(day) ? "text-primary" : "text-muted-foreground"
          )}
          style={{ left: dayLeft, width: dayWidth, height: RULER_H }}
        >
          <span className="text-[10px] uppercase tracking-wide leading-none">
            {DAY_NAMES_SHORT[day.getDay()]}
          </span>
          <span className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold leading-tight mt-0.5",
            isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
          )}>
            {day.getDate()}
          </span>
        </div>
      );
    });
  }

  function renderGridLines(machineId: string) {
    if (viewMode === "month") {
      return monthDays.map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none"
          style={{ left: (i + 1) * pxH }}
        />
      ));
    }
    const viewDays = viewMode === "day" ? [dayViewDate] : days;
    return viewDays.map((_, i) => (
      <div
        key={i}
        className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none"
        style={{ left: (i + 1) * 24 * pxH }}
      />
    ));
  }

  function renderTodayHighlight() {
    if (viewMode === "month") {
      const now = new Date();
      const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayIdx = Math.round((localMidnight.getTime() - monthStart.getTime()) / 86_400_000);
      if (dayIdx < 0 || dayIdx >= daysInMonth) return null;
      return (
        <div
          className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none"
          style={{ left: dayIdx * pxH, width: pxH }}
        />
      );
    }
    const viewDays = viewMode === "day" ? [dayViewDate] : days;
    return viewDays.map((day, i) => isToday(day) ? (
      <div
        key={i}
        className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none"
        style={{ left: i * 24 * pxH, width: 24 * pxH }}
      />
    ) : null);
  }

  const unscheduled = getUnscheduledJobs();

  return (
    <>
      {/* Navigation header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-background flex-shrink-0 flex-wrap">
        {/* Prev / label / next */}
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

        {/* View switcher */}
        <div className="flex items-center rounded-md border overflow-hidden">
          {(["day", "week", "month"] as ViewMode[]).map((vm) => (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
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
          title="Zoom zurücksetzen (Strg+Scroll zum Zoomen)"
        >
          1:1
        </Button>
      </div>

      {/* Gantt container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        style={{ cursor: "default" }}
      >
        <div style={{ width: MACHINE_COL_W + totalWidth, minWidth: "100%" }}>

          {/* Sticky ruler */}
          <div
            className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b flex"
            style={{ height: RULER_H }}
          >
            {/* Corner */}
            <div
              className="sticky left-0 z-30 bg-muted/80 backdrop-blur-sm border-r flex items-center px-3 text-xs font-medium text-muted-foreground flex-shrink-0"
              style={{ width: MACHINE_COL_W, minWidth: MACHINE_COL_W }}
            >
              Maschine
            </div>

            {/* Ruler content */}
            <div className="relative flex-1" style={{ width: totalWidth, minWidth: totalWidth }}>
              {renderRulerColumns()}

              {/* Hour ticks (day/week) */}
              {hourTicks.map((h) => {
                const tickLeft = h * pxH;
                const hour = h % 24;
                if (hour === 0) return null;
                return (
                  <div
                    key={h}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: tickLeft, transform: "translateX(-50%)" }}
                  >
                    <span className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">
                      {String(hour).padStart(2, "0")}
                    </span>
                    <div className="h-2 w-px bg-border/60" />
                  </div>
                );
              })}

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

                {/* Row canvas */}
                <div
                  className="relative flex-1 cursor-crosshair"
                  style={{ width: totalWidth, minWidth: totalWidth }}
                  onClick={(e) => handleRowClick(e, machine.id)}
                >
                  {renderGridLines(machine.id)}
                  {renderTodayHighlight()}

                  {/* Today line */}
                  {showTodayLine && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-10"
                      style={{ left: todayLineLeft }}
                    />
                  )}

                  {/* Job bars */}
                  {machineJobs.map((job) => {
                    const left = jobLeft(job.plannedAt!);
                    const width = jobBarWidth(job.printTimeMinutes);
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
