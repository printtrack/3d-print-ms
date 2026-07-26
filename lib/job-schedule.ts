import { prisma } from "./db";
import { DEFAULT_PRINT_MINUTES, FILAMENT_CHANGE_MINUTES, PLANNING_LEAD_MINUTES } from "./job-timing";
import { publish } from "./event-bus";
import { ACTIVE_JOB_STATUSES } from "./filament-changes";
import { nextAttendedMoment, nextAttendedSlot, type AttendanceConfig } from "./attendance";
import { getAttendanceConfig } from "./attendance-server";

export { FILAMENT_CHANGE_MINUTES, PLANNING_LEAD_MINUTES };

const SLOT_GRID_MINUTES = 5;

/** Jobs whose deadlines are this close together count as equally urgent, so the
 *  scheduler may reorder them to avoid a filament change. */
const URGENCY_WINDOW_MS = 48 * 3_600_000;

function earliestStart(now: Date): number {
  const grid = SLOT_GRID_MINUTES * 60_000;
  return Math.ceil((now.getTime() + PLANNING_LEAD_MINUTES * 60_000) / grid) * grid;
}

interface Interval {
  start: number;
  /** `Infinity` for open-ended downtimes — nothing can be scheduled after them. */
  end: number;
}

function firstFreeSlot(intervals: Interval[], earliest: number, durationMs: number): number | null {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let start = earliest;

  // Each conflict pushes the start past one interval, so the sorted list bounds
  // the number of iterations.
  for (let i = 0; i <= sorted.length; i++) {
    const end = start + durationMs;
    const conflict = sorted.find((iv) => start < iv.end && end > iv.start);
    if (!conflict) return start;
    if (!Number.isFinite(conflict.end)) return null;
    start = conflict.end;
  }
  return null;
}

/**
 * How long the machine stays blocked after a print finished: until somebody is
 * on site to take the plate off. Without attendance windows that is immediate.
 */
export function blockedUntil(attendance: AttendanceConfig, printEndMs: number): number {
  return nextAttendedMoment(attendance, printEndMs) ?? printEndMs;
}

export interface ScheduleResult {
  scheduledJobIds: string[];
  /** Jobs that stayed unscheduled (machine blocked by an open-ended downtime). */
  skippedJobIds: string[];
}

/**
 * Places every not-yet-scheduled job on the timeline. Explicitly triggered —
 * planning parts into jobs is automatic, deciding *when* they print is not.
 *
 * Order per machine: earliest order deadline first; among jobs of comparable
 * urgency (within {@link URGENCY_WINDOW_MS}) one that runs on the spools already
 * loaded wins, so the operator swaps filament as rarely as possible. Jobs that
 * already carry a `plannedAt` are never moved — manual scheduling wins.
 */
export async function scheduleUnplannedJobs(now: Date = new Date()): Promise<ScheduleResult> {
  const [attendance, machines, jobs, downtimes] = await Promise.all([
    getAttendanceConfig(),
    prisma.machine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        materialSlots: true,
        filamentSlots: { select: { slot: true, filamentId: true } },
      },
    }),
    prisma.printJob.findMany({
      where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        machineId: true,
        status: true,
        plannedAt: true,
        startedAt: true,
        printTimeMinutes: true,
        plannedFilaments: { select: { filamentId: true } },
        parts: { select: { orderPart: { select: { order: { select: { deadline: true } } } } } },
      },
    }),
    prisma.machineDowntime.findMany({
      where: { OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
      select: { machineId: true, startedAt: true, endedAt: true },
    }),
  ]);

  const occupied = new Map<string, Interval[]>();
  const add = (machineId: string, iv: Interval) => {
    const list = occupied.get(machineId) ?? [];
    list.push(iv);
    occupied.set(machineId, list);
  };

  for (const d of downtimes) {
    add(d.machineId, { start: d.startedAt.getTime(), end: d.endedAt ? d.endedAt.getTime() : Infinity });
  }

  const durationMs = (minutes: number | null) => (minutes ?? DEFAULT_PRINT_MINUTES) * 60_000;
  const deadlineOf = (job: (typeof jobs)[number]) => {
    const dates = job.parts
      .map((p) => p.orderPart.order.deadline?.getTime())
      .filter((t): t is number => t != null);
    return dates.length > 0 ? Math.min(...dates) : Number.POSITIVE_INFINITY;
  };

  // Spools currently on each machine — the starting point for change counting.
  const loadedByMachine = new Map<string, string[]>();
  for (const m of machines) {
    loadedByMachine.set(
      m.id,
      m.filamentSlots
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((s) => s.filamentId)
        .filter((id): id is string => id !== null)
    );
  }

  const pendingByMachine = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const anchor = job.plannedAt ?? job.startedAt;
    if (anchor) {
      const printEnd = anchor.getTime() + durationMs(job.printTimeMinutes);
      add(job.machineId, { start: anchor.getTime(), end: blockedUntil(attendance, printEnd) });
      // An already scheduled job leaves its spools on the printer.
      if (job.plannedFilaments.length > 0) {
        loadedByMachine.set(job.machineId, [...new Set(job.plannedFilaments.map((f) => f.filamentId))]);
      }
    } else if (job.status === "PLANNED" || job.status === "SLICED") {
      const list = pendingByMachine.get(job.machineId) ?? [];
      list.push(job);
      pendingByMachine.set(job.machineId, list);
    }
  }

  const scheduledJobIds: string[] = [];
  const skippedJobIds: string[] = [];
  const notBefore = earliestStart(now);

  for (const [machineId, pending] of pendingByMachine.entries()) {
    const machine = machines.find((m) => m.id === machineId);
    if (!machine) {
      skippedJobIds.push(...pending.map((j) => j.id));
      continue;
    }

    const slots = Math.max(1, machine.materialSlots);
    let loaded = loadedByMachine.get(machineId) ?? [];
    let remaining = [...pending];

    while (remaining.length > 0) {
      remaining.sort((a, b) => deadlineOf(a) - deadlineOf(b));
      const mostUrgent = deadlineOf(remaining[0]);

      // Within the urgency window, prefer a job that needs no spool swap.
      const candidates = remaining.filter((j) => deadlineOf(j) - mostUrgent <= URGENCY_WINDOW_MS);
      const noSwap = candidates.find((j) =>
        [...new Set(j.plannedFilaments.map((f) => f.filamentId))].every((id) => loaded.includes(id))
      );
      const job = noSwap ?? remaining[0];
      remaining = remaining.filter((j) => j.id !== job.id);

      const needed = [...new Set(job.plannedFilaments.map((f) => f.filamentId))];
      const requiresChange = needed.some((id) => !loaded.includes(id));

      const intervals = occupied.get(machineId) ?? [];
      const setupMs = requiresChange ? FILAMENT_CHANGE_MINUTES * 60_000 : 0;
      const printMs = durationMs(job.printTimeMinutes);

      // Starting a print can be done remotely, so it may fall into unattended
      // hours. Only the filament swap needs somebody on site — so a job that
      // requires one has to begin inside a staffed window; a job that runs on
      // the loaded spool can start any time the machine is free.
      let cursor = notBefore;
      let setupStart: number | null = null;
      for (let attempt = 0; attempt < 200; attempt++) {
        const free = firstFreeSlot(intervals, cursor, setupMs + printMs);
        if (free === null) break;
        if (!requiresChange) {
          setupStart = free;
          break;
        }
        const attended = nextAttendedSlot(attendance, free, setupMs);
        if (attended === null) break;
        if (attended === free) {
          setupStart = free;
          break;
        }
        cursor = attended;
      }
      if (setupStart === null) {
        skippedJobIds.push(job.id); // machine blocked, or no attendance window fits
        continue;
      }

      const printStart = setupStart + setupMs;
      const printEnd = printStart + printMs;
      const plannedAt = new Date(printStart);
      await prisma.printJob.update({ where: { id: job.id }, data: { plannedAt } });
      // The plate stays on the printer until somebody can take it off.
      add(machineId, { start: setupStart, end: blockedUntil(attendance, printEnd) });
      scheduledJobIds.push(job.id);

      if (needed.length > 0) {
        loaded = [...loaded.filter((id) => !needed.includes(id)), ...needed].slice(-slots);
      }
    }
  }

  for (const jobId of scheduledJobIds) publish({ type: "job.changed", jobId });

  return { scheduledJobIds, skippedJobIds };
}
