/** Job statuses that still occupy a printer slot on the timeline. */
export const ACTIVE_JOB_STATUSES = ["PLANNED", "SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION"] as const;

export interface FilamentChange {
  jobId: string;
  machineId: string;
  /** Spools that have to come off the printer (only when slots are full). */
  unload: string[];
  /** Spools that have to be loaded before this job can print. */
  load: string[];
  confirmed: boolean;
}

/** Dates may arrive as Date (server) or ISO string (serialised for the client). */
type Timestamp = Date | string | null;

export interface JobLike {
  id: string;
  machineId: string;
  plannedAt: Timestamp;
  startedAt: Timestamp;
  queuePosition: number;
  filamentChangeConfirmedAt: Timestamp;
  plannedFilaments: { filamentId: string }[];
}

function ms(value: Timestamp): number | undefined {
  if (value === null || value === undefined) return undefined;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? undefined : t;
}

export interface MachineLike {
  id: string;
  materialSlots: number;
  filamentSlots: { slot: number; filamentId: string | null }[];
}

/**
 * Walks each machine's job queue in print order and works out where the operator
 * has to swap spools. The starting point is what the printer physically holds
 * (`MachineFilamentSlot`); every job then leaves behind the set it needed.
 *
 * A job needs a change when its spools are not already loaded. With more slots
 * than needed the spool is simply added; otherwise the least recently needed one
 * is unloaded to make room.
 */
export function computeFilamentChanges(machines: MachineLike[], jobs: JobLike[]): Map<string, FilamentChange> {
  const result = new Map<string, FilamentChange>();

  for (const machine of machines) {
    const slots = Math.max(1, machine.materialSlots);
    // Loaded spools, oldest use first — that end gets evicted when space runs out.
    let loaded: string[] = machine.filamentSlots
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((s) => s.filamentId)
      .filter((id): id is string => id !== null)
      .slice(0, slots);

    const queue = jobs
      .filter((j) => j.machineId === machine.id)
      .sort((a, b) => {
        const at = ms(a.plannedAt) ?? ms(a.startedAt);
        const bt = ms(b.plannedAt) ?? ms(b.startedAt);
        if (at != null && bt != null) return at - bt;
        // Unscheduled jobs queue up behind everything that has a date.
        if (at != null) return -1;
        if (bt != null) return 1;
        return a.queuePosition - b.queuePosition;
      });

    for (const job of queue) {
      const needed = [...new Set(job.plannedFilaments.map((f) => f.filamentId))];
      const missing = needed.filter((id) => !loaded.includes(id));

      if (missing.length > 0) {
        const keep = loaded.filter((id) => needed.includes(id));
        const spare = Math.max(0, slots - keep.length - missing.length);
        // Spools that may stay because there are free slots left. `slice(-0)`
        // would return the whole array, hence the explicit guard.
        const others = loaded.filter((id) => !needed.includes(id));
        const optional = spare > 0 ? others.slice(-spare) : [];
        const unload = loaded.filter((id) => !keep.includes(id) && !optional.includes(id));

        result.set(job.id, {
          jobId: job.id,
          machineId: machine.id,
          unload,
          load: missing,
          confirmed: ms(job.filamentChangeConfirmedAt) !== undefined,
        });

        loaded = [...keep, ...optional, ...missing].slice(-slots);
      } else {
        // Mark as recently used so it survives the next eviction.
        loaded = [...loaded.filter((id) => !needed.includes(id)), ...needed];
      }
    }
  }

  return result;
}

