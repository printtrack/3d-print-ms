"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kanban, GanttChart, Loader2, AlertCircle, CalendarClock, Repeat, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { JobQueueBoard } from "./JobQueueBoard";
import { JobTimeline } from "./JobTimeline";
import { UnplannablePartsDialog } from "./UnplannablePartsDialog";
import { FilamentChangesDialog } from "./FilamentChangesDialog";
import type { PrintJob } from "./JobCard";
import type { SkippedPart } from "@/lib/job-planner";
import { nextAttendedMoment, type AttendanceConfig } from "@/lib/attendance";
import { computeFilamentChanges } from "@/lib/filament-changes";
import { DEFAULT_PRINT_MINUTES, FILAMENT_CHANGE_MINUTES } from "@/lib/job-timing";
import { useLiveEvents } from "@/lib/use-live-events";


interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  materialSlots?: number;
  filamentSlots?: { slot: number; filamentId: string | null; label: string | null; colorHex: string | null }[];
  hourlyRate: number | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  downtimes?: {
    id: string;
    reason: "MAINTENANCE" | "DEFECT";
    startedAt: string;
    endedAt: string | null;
  }[];
}

interface JobsViewProps {
  machines: Machine[];
  initialJobs: PrintJob[];
  teamMembers?: Array<{ id: string; name: string; email: string }>;
  /** Parts the auto-planner could not place — surfaced instead of silently dropped. */
  initialSkipped?: SkippedPart[];
  /** When staff is on site — drives the unattended bands on the timeline. */
  attendance?: AttendanceConfig;
}

export function JobsView({
  machines,
  initialJobs,
  teamMembers = [],
  initialSkipped = [],
  attendance,
}: JobsViewProps) {
  const t = useTranslations("admin");
  const [view, setView] = useState<"timeline" | "queue">("timeline");
  const [jobs, setJobs] = useState<PrintJob[]>(initialJobs);
  const [skipped, setSkipped] = useState<SkippedPart[]>(initialSkipped);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [shortCodeInput, setShortCodeInput] = useState("");
  const [shortCodeSearching, setShortCodeSearching] = useState(false);
  const [openJobTrigger, setOpenJobTrigger] = useState<{ id: string; nonce: number } | null>(null);
  const openNonceRef = useRef(0);
  const router = useRouter();
  const shortCodeInputRef = useRef<HTMLInputElement | null>(null);

  // Filament changes and pickup waits are DERIVED, not stored: they depend on
  // the print order, so dragging a job to another time or machine changes them.
  // Recomputing here keeps the timeline honest while the user rearranges things.
  const enrichedJobs = useMemo(() => {
    const spoolLabels = new Map<string, string>();
    for (const m of machines) {
      for (const fs of m.filamentSlots ?? []) {
        if (fs.filamentId && fs.label) spoolLabels.set(fs.filamentId, fs.label);
      }
    }
    for (const j of jobs) {
      for (const pf of j.plannedFilaments ?? []) {
        const label = pf.label ?? (pf.filament ? `${pf.filament.material} ${pf.filament.color}` : null);
        if (label) spoolLabels.set(pf.filamentId, label);
      }
    }

    const changes = computeFilamentChanges(
      machines.map((m) => ({
        id: m.id,
        materialSlots: m.materialSlots ?? 1,
        filamentSlots: (m.filamentSlots ?? []).map((fs) => ({ slot: fs.slot, filamentId: fs.filamentId })),
      })),
      jobs.map((j) => ({
        id: j.id,
        machineId: j.machineId,
        plannedAt: j.plannedAt,
        startedAt: j.startedAt,
        queuePosition: j.queuePosition,
        filamentChangeConfirmedAt: j.filamentChangeConfirmedAt ?? null,
        plannedFilaments: (j.plannedFilaments ?? []).map((pf) => ({ filamentId: pf.filamentId })),
      }))
    );

    return jobs.map((job) => {
      const change = changes.get(job.id);
      const anchor = job.plannedAt ?? job.startedAt;
      let pickupAt: string | null = null;
      if (anchor && attendance) {
        const printEnd =
          new Date(anchor).getTime() + (job.printTimeMinutes ?? DEFAULT_PRINT_MINUTES) * 60_000;
        const free = nextAttendedMoment(attendance, printEnd);
        if (free !== null && free > printEnd) pickupAt = new Date(free).toISOString();
      }
      return {
        ...job,
        filamentChange: change
          ? {
              confirmed: change.confirmed,
              load: change.load.map((id) => spoolLabels.get(id) ?? id),
              unload: change.unload.map((id) => spoolLabels.get(id) ?? id),
            }
          : null,
        setupMinutes: change && !change.confirmed ? FILAMENT_CHANGE_MINUTES : 0,
        pickupAt,
      };
    });
  }, [jobs, machines, attendance]);

  // Sync server props into local state when they change after router.refresh()
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setSkipped(initialSkipped);
  }, [initialSkipped]);

  useLiveEvents(
    useCallback(
      (event) => {
        if (event.type === "job.changed") {
          router.refresh();
        }
      },
      [router]
    )
  );

  useEffect(() => {
    async function runAutoTransition() {
      try {
        const res = await fetch("/api/admin/jobs/auto-transition", { method: "POST" });
        if (!res.ok) return;
        const { started, completed, deferred } = await res.json();
        // Jobs pushed back because their filament change is still open — the
        // server moved plannedAt, so re-read from the server.
        if ((deferred?.length ?? 0) > 0) router.refresh();
        if (started.length === 0 && completed.length === 0) return;

        const now = new Date().toISOString();
        setJobs((prev) =>
          prev.map((j) => {
            if (completed.includes(j.id)) return { ...j, status: "AWAITING_VERIFICATION" as const, completedAt: now };
            if (started.includes(j.id)) return { ...j, status: "IN_PROGRESS" as const, startedAt: now };
            return j;
          })
        );
      } catch {
        // silently ignore network errors
      }
    }

    // Also poll dispatches so printer-driven state (STARTED → PRINTING → DONE)
    // flows back into the board without a manual reload.
    async function refreshDispatches() {
      try {
        await fetch("/api/admin/dispatches/refresh", { method: "POST" });
      } catch {
        // silently ignore network errors
      }
    }

    // Parts that became print-ready meanwhile are batched into jobs without any
    // user interaction. They stay unscheduled until someone drags them onto the
    // timeline or presses "Auf Zeitachse planen".
    async function runAutoPlan() {
      try {
        const res = await fetch("/api/admin/jobs/auto-plan", { method: "POST" });
        if (!res.ok) return;
        const { createdJobIds, skipped: newSkipped } = await res.json();
        setSkipped(newSkipped ?? []);
        if ((createdJobIds?.length ?? 0) > 0) router.refresh();
      } catch {
        // silently ignore network errors
      }
    }

    async function tick() {
      await runAutoPlan();
      await runAutoTransition();
      await refreshDispatches();
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [router]);

  function handleJobCreated(job: PrintJob) {
    setJobs((prev) => [...prev, job]);
  }

  // Jobs waiting for a spool swap — in print order, so the list matches the walk
  // from printer to printer.
  const pendingChanges = enrichedJobs
    .filter((j) => j.filamentChange && !j.filamentChange.confirmed)
    .sort((a, b) => {
      const at = a.plannedAt ? new Date(a.plannedAt).getTime() : Infinity;
      const bt = b.plannedAt ? new Date(b.plannedAt).getTime() : Infinity;
      return at - bt;
    });

  async function handleAutoSchedule() {
    setScheduling(true);
    try {
      const res = await fetch("/api/admin/jobs/schedule", { method: "POST" });
      if (!res.ok) throw new Error();
      const { scheduledJobIds, skippedJobIds, skipped: newSkipped } = await res.json();
      setSkipped(newSkipped ?? []);
      router.refresh();

      if ((scheduledJobIds?.length ?? 0) === 0) {
        toast.info(t("schedule_none"));
      } else {
        toast.success(t("schedule_done", { count: scheduledJobIds.length }));
      }
      if ((skippedJobIds?.length ?? 0) > 0) {
        toast.warning(t("schedule_blocked", { count: skippedJobIds.length }));
      }
    } catch {
      toast.error(t("schedule_failed"));
    } finally {
      setScheduling(false);
    }
  }

  function handleJobUpdated(job: PrintJob) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
  }

  function handleJobDeleted(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  async function handleShortCodeSearch(e: React.FormEvent) {
    e.preventDefault();
    const code = shortCodeInput.trim().toUpperCase();
    if (!code) return;
    setShortCodeSearching(true);
    try {
      // Check local state first — match shortCode or the ID-suffix fallback used by the label
      const local = jobs.find((j) => (j.shortCode ?? j.id.slice(-6)).toUpperCase() === code);
      if (local) {
        setView("queue");
        setOpenJobTrigger({ id: local.id, nonce: ++openNonceRef.current });
        setShortCodeInput("");
        return;
      }
      const res = await fetch(`/api/admin/jobs?shortCode=${encodeURIComponent(code)}`);
      const data = await res.json();
      const job = Array.isArray(data) ? data[0] : null;
      if (!job) {
        toast.error(`Kein Job mit ID „${code}" gefunden`);
        return;
      }
      setView("queue");
      setOpenJobTrigger({ id: job.id, nonce: ++openNonceRef.current });
      setShortCodeInput("");
    } catch {
      toast.error("Fehler bei der Suche");
    } finally {
      setShortCodeSearching(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Druckjobs</h1>
          <p className="text-muted-foreground text-sm">
            {view === "timeline" ? "Gantt-Ansicht" : "Board-Ansicht"} · {t("auto_planning_hint")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <form onSubmit={handleShortCodeSearch} className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={shortCodeInputRef}
                value={shortCodeInput}
                onChange={(e) => setShortCodeInput(e.target.value)}
                placeholder="Job-ID (Etikett)"
                className="pl-8 h-8 w-36 text-xs font-mono"
                maxLength={6}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!shortCodeInput.trim() || shortCodeSearching}
            >
              {shortCodeSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Suchen"}
            </Button>
          </form>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            data-testid="auto-schedule-btn"
            disabled={scheduling}
            onClick={handleAutoSchedule}
          >
            {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            {t("schedule_cta")}
          </Button>
          {pendingChanges.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-amber-700 dark:text-amber-500"
              data-testid="filament-changes-btn"
              onClick={() => setChangesOpen(true)}
            >
              <Repeat className="h-3.5 w-3.5" />
              {t("filament_changes_badge", { count: pendingChanges.length })}
            </Button>
          )}
          {skipped.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-amber-700 dark:text-amber-500"
              data-testid="unplannable-btn"
              onClick={() => setSkippedOpen(true)}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {t("unplannable_badge", { count: skipped.length })}
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "queue" && "bg-muted")}
            onClick={() => setView("queue")}
          >
            <Kanban className="h-3.5 w-3.5" />
            Board
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "timeline" && "bg-muted")}
            onClick={() => setView("timeline")}
          >
            <GanttChart className="h-3.5 w-3.5" />
            Gantt
          </Button>
          </div>
        </div>
      </div>

      <UnplannablePartsDialog open={skippedOpen} onOpenChange={setSkippedOpen} parts={skipped} />

      <FilamentChangesDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        jobs={pendingChanges}
        onConfirmed={() => router.refresh()}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {view === "timeline" ? (
          <JobTimeline
            machines={machines}
            jobs={enrichedJobs}
            attendance={attendance}
            onJobCreated={handleJobCreated}
            onJobUpdated={handleJobUpdated}
            onJobDeleted={handleJobDeleted}
            teamMembers={teamMembers}
          />
        ) : (
          <JobQueueBoard
            machines={machines}
            initialJobs={enrichedJobs}
            onJobCreated={handleJobCreated}
            onJobUpdated={handleJobUpdated}
            onJobDeleted={handleJobDeleted}
            teamMembers={teamMembers}
            openJobTrigger={openJobTrigger}
          />
        )}
      </div>
    </div>
  );
}
