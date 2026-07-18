import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { z } from "zod";
import { sendOrderRejectedEmail } from "@/lib/email";
import { publish } from "@/lib/event-bus";

const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await assertOrderAccess(id, "orders.reject");
  if (guard) return guard;

  try {
    const { reason } = rejectSchema.parse(await req.json());

    const current = await prisma.order.findUnique({
      where: { id },
      include: { phase: { select: { name: true, isRejected: true } } },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.phase.isRejected) {
      return NextResponse.json({ error: "Auftrag ist bereits abgelehnt" }, { status: 409 });
    }

    const rejectedPhase = await prisma.orderPhase.findFirst({
      where: { isRejected: true },
      select: { id: true, name: true },
    });
    if (!rejectedPhase) {
      return NextResponse.json(
        { error: "Keine Abgelehnt-Phase konfiguriert" },
        { status: 409 }
      );
    }

    const userId = (await getActor())?.id;
    const now = new Date();

    const updated = await prisma.order.update({
      where: { id },
      data: {
        phaseId: rejectedPhase.id,
        rejectedAt: now,
        rejectionReason: reason,
        archivedAt: now,
      },
      include: {
        phase: { select: { id: true, name: true, color: true } },
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          orderId: id,
          userId: userId ?? null,
          action: "PHASE_CHANGED",
          details: `Phase geändert von "${current.phase.name}" zu "${rejectedPhase.name}"`,
        },
        {
          orderId: id,
          userId: userId ?? null,
          action: "ORDER_REJECTED",
          details: `Auftrag abgelehnt — Grund: ${reason}`,
        },
      ],
    });

    sendOrderRejectedEmail({
      customerEmail: current.customerEmail,
      customerName: current.customerName,
      reason,
      trackingToken: current.trackingToken,
    }).catch((err) => console.error("[email] Rejection notification failed:", err));

    publish({ type: "order.changed", orderId: id });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Order reject error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
