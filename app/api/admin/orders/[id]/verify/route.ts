import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/email";

const postSchema = z.object({
  type: z.enum(["DESIGN_REVIEW", "PRICE_APPROVAL"]),
});

const patchSchema = z.object({
  verificationRequestId: z.string(),
  action: z.enum(["APPROVE", "REJECT"]).default("APPROVE"),
  message: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id;

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        trackingToken: true,
        customerName: true,
        customerEmail: true,
        priceEstimate: true,
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Sequential check: PRICE_APPROVAL requires an APPROVED DESIGN_REVIEW
    if (data.type === "PRICE_APPROVAL") {
      const designApproved = await prisma.verificationRequest.findFirst({
        where: { orderId: id, type: "DESIGN_REVIEW", status: "APPROVED" },
      });
      if (!designApproved) {
        return NextResponse.json(
          { error: "Designfreigabe muss zuerst genehmigt werden" },
          { status: 400 }
        );
      }
    }

    // Block if already PENDING for this type
    const pending = await prisma.verificationRequest.findFirst({
      where: { orderId: id, type: data.type, status: "PENDING" },
    });
    if (pending) {
      return NextResponse.json({ error: "Freigabeanfrage bereits ausstehend" }, { status: 409 });
    }

    const vr = await prisma.verificationRequest.create({
      data: { orderId: id, type: data.type },
    });

    const typeLabel = data.type === "DESIGN_REVIEW" ? "Designfreigabe" : "Angebotsfreigabe";
    await prisma.auditLog.create({
      data: {
        orderId: id,
        userId: userId ?? null,
        action: "VERIFICATION_SENT",
        details: `${typeLabel} Anfrage versandt`,
      },
    });

    const priceEstimate = order.priceEstimate ? Number(order.priceEstimate) : undefined;
    sendVerificationEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      verificationToken: vr.token,
      type: data.type,
      trackingToken: order.trackingToken,
      priceEstimate: data.type === "PRICE_APPROVAL" ? priceEstimate : undefined,
    }).catch((err) => console.error("[email] Verification email failed:", err));

    return NextResponse.json(
      {
        id: vr.id,
        type: vr.type,
        status: vr.status,
        sentAt: vr.sentAt.toISOString(),
        resolvedAt: null,
        orderPartId: null,
        rejectionReason: null,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Verification send error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const vr = await prisma.verificationRequest.findUnique({
      where: { id: data.verificationRequestId },
    });
    if (!vr || vr.orderId !== id) {
      return NextResponse.json({ error: "Freigabe nicht gefunden" }, { status: 404 });
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
        resolvedBy: userId ?? null,
        rejectionReason: isApprove ? null : (data.message ?? null),
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
              orderId: id,
              userId: userId ?? null,
              action: "PART_APPROVED",
              details: `Designfreigabe genehmigt – Teil auf Phase "${printReadyPhase.name}" gesetzt`,
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
        orderId: id,
        userId: userId ?? null,
        action: isApprove ? "VERIFICATION_OVERRIDDEN" : "VERIFICATION_REJECTED",
        details: isApprove
          ? "Freigabe durch Admin erteilt"
          : `Freigabe durch Admin abgelehnt${data.message ? `: ${data.message}` : ""}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Admin verification override error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
