import { prisma } from "@/lib/db";

export type DowntimeState = "SCHEDULED" | "ACTIVE" | "RESOLVED";

/** A downtime is "active" when it has started but not yet ended. */
export function isDownAt(
  startedAt: Date,
  endedAt: Date | null,
  at: Date = new Date()
): boolean {
  return startedAt.getTime() <= at.getTime() && (endedAt === null || endedAt.getTime() > at.getTime());
}

/** Derive the lifecycle state of a downtime record relative to `now`. */
export function downtimeState(
  dt: { startedAt: Date; endedAt: Date | null },
  now: Date = new Date()
): DowntimeState {
  if (dt.endedAt !== null && dt.endedAt.getTime() <= now.getTime()) return "RESOLVED";
  if (dt.startedAt.getTime() > now.getTime()) return "SCHEDULED";
  return "ACTIVE";
}

/**
 * IDs of machines that are down *right now* (active downtime).
 * Used to exclude machines from the planner and from auto-start.
 */
export async function currentlyDownMachineIds(now: Date = new Date()): Promise<Set<string>> {
  const rows = await prisma.machineDowntime.findMany({
    where: {
      startedAt: { lte: now },
      OR: [{ endedAt: null }, { endedAt: { gt: now } }],
    },
    select: { machineId: true },
  });
  return new Set(rows.map((r) => r.machineId));
}

/**
 * Jobs affected by a machine going down: everything not yet finished on that
 * machine that overlaps the downtime — i.e. running jobs plus planned jobs
 * scheduled at or after the downtime start.
 */
export async function affectedJobsForDowntime(machineId: string, startedAt: Date) {
  return prisma.printJob.findMany({
    where: {
      machineId,
      status: { in: ["PLANNED", "SLICED", "IN_PROGRESS"] },
      OR: [
        { status: "IN_PROGRESS" },
        { plannedAt: { gte: startedAt } },
      ],
    },
    orderBy: { plannedAt: "asc" },
    include: {
      parts: {
        include: {
          orderPart: {
            select: {
              id: true,
              name: true,
              bboxXmm: true,
              bboxYmm: true,
              bboxZmm: true,
              order: { select: { id: true } },
            },
          },
        },
      },
    },
  });
}
