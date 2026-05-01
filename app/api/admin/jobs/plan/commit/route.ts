import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const commitSchema = z.object({
  jobs: z.array(
    z.object({
      machineId: z.string().min(1),
      partIds: z.array(z.string().min(1)).min(1),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const body = await req.json();
    const { jobs } = commitSchema.parse(body);

    const created: { id: string; machineId: string; partCount: number }[] = [];

    for (const { machineId, partIds } of jobs) {
      const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { name: true } });
      if (!machine) continue;

      const last = await prisma.printJob.findFirst({
        where: { machineId },
        orderBy: { queuePosition: "desc" },
      });
      const queuePosition = (last?.queuePosition ?? -1) + 1;

      const job = await prisma.printJob.create({
        data: {
          machineId,
          plannedAt: null,
          queuePosition,
          parts: { create: partIds.map((orderPartId) => ({ orderPartId })) },
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

      created.push({ id: job.id, machineId, partCount: partIds.length });
    }

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
