import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmFilamentChange } from "@/lib/filament-changes-server";
import { publish } from "@/lib/event-bus";

/** Marks the spool swap for this job as done and updates the printer's slots. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id?: string })?.id ?? null;

  const job = await prisma.printJob.findUnique({
    where: { id },
    select: {
      id: true,
      machine: { select: { name: true } },
      parts: { select: { orderPart: { select: { orderId: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await confirmFilamentChange(id, userId);

  const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
  if (orderIds.length > 0) {
    await prisma.auditLog.createMany({
      data: orderIds.map((orderId) => ({
        orderId,
        userId,
        action: "FILAMENT_CHANGED",
        details: `Filamentwechsel auf ${job.machine.name} bestätigt`,
      })),
    });
  }

  publish({ type: "job.changed", jobId: id });

  return NextResponse.json({ success: true });
}
