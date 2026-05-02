import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const jobEntrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("new"), machineId: z.string().min(1), partIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("extend"), existingJobId: z.string().min(1), partIds: z.array(z.string().min(1)).min(1) }),
]);

const commitSchema = z.object({
  jobs: z.array(jobEntrySchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const body = await req.json();
    const { jobs } = commitSchema.parse(body);

    const created: { id: string; machineId: string; partCount: number }[] = [];

    for (const entry of jobs) {
      // Filter out parts already assigned to an active job
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
          where: { id: entry.existingJobId },
          select: { id: true, machineId: true, machine: { select: { name: true } } },
        });
        if (!existingJob) continue;

        await prisma.printJobPart.createMany({
          data: safePartIds.map((orderPartId) => ({ printJobId: existingJob.id, orderPartId })),
          skipDuplicates: true,
        });

        const orderIds = [...new Set(
          await prisma.orderPart.findMany({ where: { id: { in: safePartIds } }, select: { orderId: true } })
            .then((rows) => rows.map((r) => r.orderId))
        )];
        if (orderIds.length > 0) {
          await prisma.auditLog.createMany({
            data: orderIds.map((orderId) => ({
              orderId,
              userId,
              action: "JOB_AUTOPLANNED",
              details: `Teile zu bestehendem Job auf ${existingJob.machine.name} hinzugefügt (Auto-Planner)`,
            })),
          });
        }

        created.push({ id: existingJob.id, machineId: existingJob.machineId, partCount: safePartIds.length });
      } else {
        const machine = await prisma.machine.findUnique({ where: { id: entry.machineId }, select: { name: true } });
        if (!machine) continue;

        const last = await prisma.printJob.findFirst({
          where: { machineId: entry.machineId },
          orderBy: { queuePosition: "desc" },
        });
        const queuePosition = (last?.queuePosition ?? -1) + 1;

        const job = await prisma.printJob.create({
          data: {
            machineId: entry.machineId,
            plannedAt: null,
            queuePosition,
            parts: { create: safePartIds.map((orderPartId) => ({ orderPartId })) },
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
              details: `Job ${job.id} auf ${machine.name} (Auto-Planner)`,
            })),
          });
        }

        created.push({ id: job.id, machineId: entry.machineId, partCount: safePartIds.length });
      }
    }

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
