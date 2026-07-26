import { prisma } from "./db";
import { plan, type SkippedPart } from "./job-planner";
import { publish } from "./event-bus";

export interface CommitEntry {
  type: "new" | "extend";
  machineId?: string;
  existingJobId?: string;
  partIds: string[];
  /** Spools the planner picked for these parts — the job's "should be loaded" set. */
  filamentIds?: string[];
}

export interface CommitResult {
  id: string;
  machineId: string;
  partCount: number;
}

/**
 * Writes planner proposals to the DB. Parts that meanwhile landed in another
 * active job are dropped silently — the planner works on a snapshot.
 */
export async function commitPlan(entries: CommitEntry[], userId: string | null): Promise<CommitResult[]> {
  const created: CommitResult[] = [];

  for (const entry of entries) {
    const safePartIds: string[] = [];
    for (const orderPartId of entry.partIds) {
      const conflict = await prisma.printJobPart.findFirst({
        where: { orderPartId, printJob: { status: { notIn: ["DONE", "CANCELLED"] } } },
      });
      if (!conflict) safePartIds.push(orderPartId);
    }
    if (safePartIds.length === 0) continue;

    if (entry.type === "extend") {
      const existingJob = await prisma.printJob.findUnique({
        where: { id: entry.existingJobId! },
        select: { id: true, machineId: true, status: true, startedAt: true, machine: { select: { name: true } } },
      });
      // Never touch a job that started printing in the meantime.
      if (!existingJob || existingJob.startedAt !== null || existingJob.status !== "PLANNED") continue;

      await prisma.printJobPart.createMany({
        data: safePartIds.map((orderPartId) => ({ printJobId: existingJob.id, orderPartId })),
        skipDuplicates: true,
      });

      if (entry.filamentIds?.length) {
        await prisma.printJobPlannedFilament.createMany({
          data: entry.filamentIds.map((filamentId) => ({ printJobId: existingJob.id, filamentId })),
          skipDuplicates: true,
        });
      }

      const orderIds = [
        ...new Set(
          (await prisma.orderPart.findMany({ where: { id: { in: safePartIds } }, select: { orderId: true } })).map(
            (r) => r.orderId
          )
        ),
      ];
      if (orderIds.length > 0) {
        await prisma.auditLog.createMany({
          data: orderIds.map((orderId) => ({
            orderId,
            userId,
            action: "JOB_AUTOPLANNED",
            details: `Teile zu bestehendem Job auf ${existingJob.machine.name} hinzugefügt (Auto-Planer)`,
          })),
        });
      }

      created.push({ id: existingJob.id, machineId: existingJob.machineId, partCount: safePartIds.length });
    } else {
      const machine = await prisma.machine.findUnique({ where: { id: entry.machineId! }, select: { name: true } });
      if (!machine) continue;

      const last = await prisma.printJob.findFirst({
        where: { machineId: entry.machineId! },
        orderBy: { queuePosition: "desc" },
      });
      const queuePosition = (last?.queuePosition ?? -1) + 1;

      const job = await prisma.printJob.create({
        data: {
          machineId: entry.machineId!,
          plannedAt: null,
          queuePosition,
          parts: { create: safePartIds.map((orderPartId) => ({ orderPartId })) },
          plannedFilaments: {
            create: (entry.filamentIds ?? []).map((filamentId) => ({ filamentId })),
          },
        },
        include: { parts: { include: { orderPart: { select: { orderId: true } } } } },
      });

      const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
      if (orderIds.length > 0) {
        await prisma.auditLog.createMany({
          data: orderIds.map((orderId) => ({
            orderId,
            userId,
            action: "JOB_AUTOPLANNED",
            details: `Job ${job.id} auf ${machine.name} (Auto-Planer)`,
          })),
        });
      }

      created.push({ id: job.id, machineId: entry.machineId!, partCount: safePartIds.length });
    }
  }

  return created;
}

export interface AutoPlanResult {
  createdJobIds: string[];
  skipped: SkippedPart[];
}

/**
 * Batching without any user interaction: propose jobs for all print-ready parts
 * and create/extend them. Scheduling is deliberately NOT part of this — a job
 * only lands on the timeline when someone drags it there or presses "auto-schedule"
 * (see lib/job-schedule.ts).
 *
 * Proposals exceeding the filament stock are created too — the shortage is
 * surfaced in the inventory rather than silently blocking production.
 */
export async function runAutoPlan(userId: string | null = null): Promise<AutoPlanResult> {
  const { proposed, skipped } = await plan();

  const entries: CommitEntry[] = proposed.map((p) =>
    p.type === "extend"
      ? {
          type: "extend" as const,
          existingJobId: p.existingJobId,
          partIds: p.parts.map((x) => x.orderPartId),
          filamentIds: p.filamentIds,
        }
      : {
          type: "new" as const,
          machineId: p.machineId,
          partIds: p.parts.map((x) => x.orderPartId),
          filamentIds: p.filamentIds,
        }
  );

  const created = entries.length > 0 ? await commitPlan(entries, userId) : [];

  for (const jobId of new Set(created.map((c) => c.id))) publish({ type: "job.changed", jobId });

  return { createdJobIds: [...new Set(created.map((c) => c.id))], skipped };
}

// A single run at a time: the planner reads a global snapshot, so parallel runs
// would propose the same parts twice. Concurrent callers share the running promise.
let inFlight: Promise<AutoPlanResult> | null = null;

export function runAutoPlanExclusive(userId: string | null = null): Promise<AutoPlanResult> {
  if (inFlight) return inFlight;
  inFlight = runAutoPlan(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Fire-and-forget variant for request handlers that shouldn't wait on planning. */
export function triggerAutoPlan(userId: string | null = null): void {
  void runAutoPlanExclusive(userId).catch(() => {
    // planning is best-effort — never fail the triggering request
  });
}
