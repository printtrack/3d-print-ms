import { prisma } from "@/lib/db";
import { currentlyDownMachineIds } from "@/lib/machine-downtime";
import { getFilamentChanges } from "@/lib/filament-changes-server";
import { DEFAULT_PRINT_MINUTES } from "@/lib/job-timing";

/** How far a job is pushed back while its filament change is still pending. */
const FILAMENT_CHANGE_DEFER_MINUTES = 15;

export async function runJobAutoTransition(): Promise<{
  started: string[];
  completed: string[];
  deferred: string[];
}> {
  const now = new Date();

  // 1. PLANNED/SLICED → IN_PROGRESS: plannedAt has passed
  const [downMachineIds, filamentChanges] = await Promise.all([
    currentlyDownMachineIds(now),
    getFilamentChanges(),
  ]);
  const due = (
    await prisma.printJob.findMany({
      where: {
        status: { in: ["PLANNED", "SLICED"] },
        plannedAt: { lte: now, not: null },
      },
      include: { parts: { include: { orderPart: true } }, machine: { select: { name: true } } },
    })
    // Don't auto-start jobs on a machine that is currently down — it can't print.
  ).filter((job) => !downMachineIds.has(job.machineId));

  // A job whose spool swap is still open must not start: the printer holds the
  // wrong filament. Push it back instead of silently printing the wrong thing.
  const deferred: string[] = [];
  const toStart: typeof due = [];
  for (const job of due) {
    const change = filamentChanges.get(job.id);
    if (change && !change.confirmed) {
      await prisma.printJob.update({
        where: { id: job.id },
        data: { plannedAt: new Date(now.getTime() + FILAMENT_CHANGE_DEFER_MINUTES * 60_000) },
      });
      deferred.push(job.id);
      continue;
    }
    toStart.push(job);
  }

  for (const job of toStart) {
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "IN_PROGRESS", startedAt: now },
    });

    const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
    if (orderIds.length > 0) {
      await prisma.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          orderId,
          userId: null,
          action: "JOB_STARTED",
          details: `Job ${job.id} auf ${job.machine.name} (automatisch gestartet)`,
        })),
      });
    }
  }

  // 2. IN_PROGRESS → AWAITING_VERIFICATION: startedAt (or plannedAt) + print time elapsed.
  // Jobs without a measured print time use the same default the timeline draws
  // with — otherwise a job whose bar has long ended would sit in "printing"
  // forever and never ask for verification.
  const inProgress = await prisma.printJob.findMany({
    where: { status: "IN_PROGRESS" },
    include: { parts: { include: { orderPart: true } }, machine: { select: { name: true } } },
  });

  const toComplete = inProgress.filter((job) => {
    const baseTime = job.startedAt ?? job.plannedAt;
    if (!baseTime) return false;
    const endMs = baseTime.getTime() + (job.printTimeMinutes ?? DEFAULT_PRINT_MINUTES) * 60_000;
    return endMs <= now.getTime();
  });

  for (const job of toComplete) {
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "AWAITING_VERIFICATION", completedAt: now },
    });

    const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
    if (orderIds.length > 0) {
      await prisma.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          orderId,
          userId: null,
          action: "JOB_AWAITING_VERIFICATION",
          details: `Job ${job.id} auf ${job.machine.name} — Verifikation ausstehend`,
        })),
      });
    }
  }

  return {
    started: toStart.map((j) => j.id),
    completed: toComplete.map((j) => j.id),
    deferred,
  };
}
