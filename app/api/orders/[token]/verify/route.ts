import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  verificationToken: z.string(),
  action: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await req.json();
    const data = bodySchema.parse(body);

    const order = await prisma.order.findUnique({
      where: { trackingToken: token },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });

    const vr = await prisma.verificationRequest.findUnique({
      where: { token: data.verificationToken },
    });
    if (!vr || vr.orderId !== order.id) {
      return NextResponse.json({ error: "Ungültiger Freigabe-Token" }, { status: 404 });
    }
    if (vr.status !== "PENDING") {
      return NextResponse.json({ error: "Freigabe bereits verarbeitet" }, { status: 409 });
    }

    const isApprove = data.action === "APPROVE";
    await prisma.verificationRequest.update({
      where: { id: vr.id },
      data: {
        status: isApprove ? "APPROVED" : "REJECTED",
        resolvedAt: new Date(),
        rejectionReason: isApprove ? null : (data.rejectionReason ?? null),
      },
    });

    if (vr.orderPartId) {
      if (isApprove) {
        const printReadyPhase = await prisma.partPhase.findFirst({ where: { isPrintReady: true } });
        if (printReadyPhase) {
          await prisma.orderPart.update({
            where: { id: vr.orderPartId },
            data: { partPhaseId: printReadyPhase.id },
          });
          await prisma.auditLog.create({
            data: {
              orderId: order.id,
              userId: null,
              action: "PART_APPROVED",
              details: `Designfreigabe durch Kunden erteilt – Teil auf Phase "${printReadyPhase.name}" gesetzt`,
            },
          });
        }
      } else {
        const defaultPhase = await prisma.partPhase.findFirst({ where: { isDefault: true } });
        if (defaultPhase) {
          await prisma.orderPart.update({
            where: { id: vr.orderPartId },
            data: { partPhaseId: defaultPhase.id },
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: isApprove ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
        details: isApprove
          ? "Freigabe durch Kunden erteilt"
          : `Freigabe durch Kunden abgelehnt${data.rejectionReason ? `: ${data.rejectionReason}` : ""}`,
      },
    });

    return NextResponse.json({ success: true, status: isApprove ? "APPROVED" : "REJECTED" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
