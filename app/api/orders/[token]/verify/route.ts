import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  verificationToken: z.string(),
  action: z.enum(["APPROVE", "REJECT"]),
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

    const newStatus = data.action === "APPROVE" ? "APPROVED" : "REJECTED";
    await prisma.verificationRequest.update({
      where: { id: vr.id },
      data: { status: newStatus, resolvedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: data.action === "APPROVE" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
        details: data.action === "APPROVE" ? "Freigabe durch Kunden erteilt" : "Freigabe durch Kunden abgelehnt",
      },
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
