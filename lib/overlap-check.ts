import { prisma } from "@/lib/db";
import { isAttended } from "@/lib/attendance";
import { getAttendanceConfig } from "@/lib/attendance-server";
import { blockedUntil } from "@/lib/job-schedule";

export { DEFAULT_PRINT_MINUTES } from "./job-timing";
import { DEFAULT_PRINT_MINUTES } from "./job-timing";

interface OverlapParams {
  machineId: string;
  plannedAt: Date;
  printTimeMinutes: number | null;
  excludeJobId?: string;
}

interface OverlapResult {
  overlapping: boolean;
  conflictJobId?: string;
  /** True when the clash is with a finished plate nobody has taken off yet. */
  conflictIsPickupWait?: boolean;
}

/**
 * Checks whether a job's time range collides with another active job on the same
 * machine. A job occupies its printer from its start until the plate can be taken
 * off — with attendance hours configured that is later than the print end, because
 * a finished print keeps the bed busy until somebody is on site.
 *
 * Active = status NOT IN ('DONE', 'CANCELLED'). Jobs without printTimeMinutes use
 * DEFAULT_PRINT_MINUTES as their duration.
 */
export async function checkJobOverlap({
  machineId,
  plannedAt,
  printTimeMinutes,
  excludeJobId,
}: OverlapParams): Promise<OverlapResult> {
  const [attendance, jobs] = await Promise.all([
    getAttendanceConfig(),
    prisma.printJob.findMany({
      where: {
        machineId,
        status: { notIn: ["DONE", "CANCELLED"] },
        plannedAt: { not: null },
        ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      },
      select: { id: true, plannedAt: true, printTimeMinutes: true },
    }),
  ]);

  const occupancy = (start: number, minutes: number | null) => {
    const printEnd = start + (minutes ?? DEFAULT_PRINT_MINUTES) * 60_000;
    return { start, printEnd, end: blockedUntil(attendance, printEnd) };
  };

  const candidate = occupancy(plannedAt.getTime(), printTimeMinutes);

  for (const job of jobs) {
    const other = occupancy(job.plannedAt!.getTime(), job.printTimeMinutes);
    if (candidate.start < other.end && candidate.end > other.start) {
      return {
        overlapping: true,
        conflictJobId: job.id,
        // Distinguishes "still printing" from "printed, plate not cleared yet"
        conflictIsPickupWait: candidate.start >= other.printEnd,
      };
    }
  }

  return { overlapping: false };
}

/**
 * A print can only be started when somebody is there to load the plate — false
 * for a start that falls into an unattended stretch.
 */
export async function isStartAttended(plannedAt: Date): Promise<boolean> {
  return isAttended(await getAttendanceConfig(), plannedAt);
}
