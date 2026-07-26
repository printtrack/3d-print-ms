import { prisma } from "./db";
import { publish } from "./event-bus";
import { triggerAutoPlan } from "./job-auto-plan";

/** Jobs whose plate can still be re-arranged. */
const OPEN_JOB_STATUSES = ["PLANNED", "SLICED"] as const;

/** A dispatch in one of these states means the plate is already on its way to the printer. */
const LIVE_DISPATCH_STATUSES = ["QUEUED", "UPLOADING", "UPLOADED", "HELD", "STARTED", "PRINTING"] as const;

export interface ReplanResult {
  /** Jobs the part was removed from. */
  releasedJobIds: string[];
  /** Jobs deleted because they ran empty. */
  deletedJobIds: string[];
  /** Jobs that already print (or were dispatched) — the part stays assigned. */
  blockedJobIds: string[];
}

/**
 * Pulls parts out of every open print job after their spec changed (colour,
 * material, quantity, orientation, design, phase). Jobs that already started
 * printing — or whose plate was dispatched to a printer — are left untouched:
 * the physical print is running against the old spec and only a human can
 * decide what to do about it.
 *
 * Empty jobs are deleted so the timeline doesn't fill up with hollow slots.
 */
export async function releasePartsForReplan(
  orderPartIds: string[],
  reason: string,
  userId: string | null = null
): Promise<ReplanResult> {
  const result: ReplanResult = { releasedJobIds: [], deletedJobIds: [], blockedJobIds: [] };
  if (orderPartIds.length === 0) return result;

  const links = await prisma.printJobPart.findMany({
    where: {
      orderPartId: { in: orderPartIds },
      printJob: { status: { in: [...OPEN_JOB_STATUSES] } },
    },
    include: {
      printJob: {
        select: {
          id: true,
          startedAt: true,
          machine: { select: { name: true } },
          dispatches: { where: { status: { in: [...LIVE_DISPATCH_STATUSES] } }, select: { id: true } },
        },
      },
      orderPart: { select: { id: true, name: true, orderId: true } },
    },
  });

  const touchedJobIds = new Set<string>();

  for (const link of links) {
    if (link.printJob.startedAt !== null || link.printJob.dispatches.length > 0) {
      result.blockedJobIds.push(link.printJob.id);
      continue;
    }

    await prisma.printJobPart.delete({
      where: { printJobId_orderPartId: { printJobId: link.printJobId, orderPartId: link.orderPartId } },
    });

    await prisma.auditLog.create({
      data: {
        orderId: link.orderPart.orderId,
        userId,
        action: "JOB_REPLANNED",
        details: `Teil "${link.orderPart.name}" aus Job auf ${link.printJob.machine.name} entfernt (${reason}) – wird neu eingeplant`,
      },
    });

    result.releasedJobIds.push(link.printJob.id);
    touchedJobIds.add(link.printJob.id);
  }

  for (const jobId of touchedJobIds) {
    const remaining = await prisma.printJobPart.count({ where: { printJobId: jobId } });
    if (remaining === 0) {
      await prisma.printJob.delete({ where: { id: jobId } });
      result.deletedJobIds.push(jobId);
    }
  }

  for (const jobId of touchedJobIds) publish({ type: "job.changed", jobId });

  return result;
}

/**
 * Release + immediate re-planning. Fire-and-forget on the planning side so the
 * triggering request (e.g. a part PATCH) stays fast.
 */
export async function replanParts(
  orderPartIds: string[],
  reason: string,
  userId: string | null = null
): Promise<ReplanResult> {
  const result = await releasePartsForReplan(orderPartIds, reason, userId);
  triggerAutoPlan(userId);
  return result;
}

/**
 * All parts sharing a design with the given one (colour variants) plus the part
 * itself — a design change hits every member of the variant group.
 */
export async function designSiblingPartIds(orderPartId: string): Promise<string[]> {
  const part = await prisma.orderPart.findUnique({
    where: { id: orderPartId },
    select: { id: true, variantGroupId: true },
  });
  if (!part) return [];
  if (!part.variantGroupId) return [part.id];

  const siblings = await prisma.orderPart.findMany({
    where: { variantGroupId: part.variantGroupId },
    select: { id: true },
  });
  return siblings.map((s) => s.id);
}

/**
 * Drops the cached bounding box so the planner re-measures the new STL. Without
 * this a new design would be packed using the old geometry.
 */
export async function invalidateBboxCache(orderPartIds: string[]): Promise<void> {
  if (orderPartIds.length === 0) return;
  await prisma.orderPart.updateMany({
    where: { id: { in: orderPartIds } },
    data: { bboxXmm: null, bboxYmm: null, bboxZmm: null },
  });
}
