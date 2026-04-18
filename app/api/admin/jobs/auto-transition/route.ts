import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductFilamentInventory } from "@/lib/filament-inventory";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // 1. PLANNED/SLICED → IN_PROGRESS: plannedAt has passed
  const toStart = await prisma.printJob.findMany({
    where: {
      status: { in: ["PLANNED", "SLICED"] },
      plannedAt: { lte: now, not: null },
    },
    include: { parts: { include: { orderPart: true } }, machine: { select: { name: true } } },
  });

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

  // 2. IN_PROGRESS → DONE: startedAt (or plannedAt) + printTimeMinutes has elapsed
  const inProgress = await prisma.printJob.findMany({
    where: {
      status: "IN_PROGRESS",
      printTimeMinutes: { not: null },
    },
    include: { parts: { include: { orderPart: true } }, machine: { select: { name: true } } },
  });

  const toComplete = inProgress.filter((job) => {
    const baseTime = job.startedAt ?? job.plannedAt;
    if (!baseTime) return false;
    const endMs = baseTime.getTime() + job.printTimeMinutes! * 60_000;
    return endMs <= now.getTime();
  });

  for (const job of toComplete) {
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "DONE", completedAt: now },
    });

    await deductFilamentInventory(job.id);

    const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
    if (orderIds.length > 0) {
      await prisma.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          orderId,
          userId: null,
          action: "JOB_COMPLETED",
          details: `Job ${job.id} auf ${job.machine.name} (automatisch abgeschlossen)`,
        })),
      });
    }
  }

  return NextResponse.json({
    started: toStart.map((j) => j.id),
    completed: toComplete.map((j) => j.id),
  });
}
