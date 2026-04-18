import { prisma } from "@/lib/db";

export const DEFAULT_PRINT_MINUTES = 120;

interface OverlapParams {
  machineId: string;
  plannedAt: Date;
  printTimeMinutes: number | null;
  excludeJobId?: string;
}

interface OverlapResult {
  overlapping: boolean;
  conflictJobId?: string;
}

/**
 * Checks whether a job's time range overlaps with any other active job on the same machine.
 * Active = status NOT IN ('DONE', 'CANCELLED').
 * Jobs without printTimeMinutes use DEFAULT_PRINT_MINUTES as their duration.
 */
export async function checkJobOverlap({
  machineId,
  plannedAt,
  printTimeMinutes,
  excludeJobId,
}: OverlapParams): Promise<OverlapResult> {
  const durationMinutes = printTimeMinutes ?? DEFAULT_PRINT_MINUTES;
  const newStart = plannedAt;
  const newEnd = new Date(plannedAt.getTime() + durationMinutes * 60_000);

  // MariaDB raw query: find any overlapping job using DATE_ADD for arithmetic
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM PrintJob
    WHERE machineId = ${machineId}
      AND id != ${excludeJobId ?? ""}
      AND status NOT IN ('DONE', 'CANCELLED')
      AND plannedAt IS NOT NULL
      AND plannedAt < ${newEnd}
      AND DATE_ADD(plannedAt, INTERVAL COALESCE(printTimeMinutes, ${DEFAULT_PRINT_MINUTES}) MINUTE) > ${newStart}
    LIMIT 1
  `;

  if (results.length > 0) {
    return { overlapping: true, conflictJobId: results[0].id };
  }
  return { overlapping: false };
}
