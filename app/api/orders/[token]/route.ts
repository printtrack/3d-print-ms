import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { trackingToken: token },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        deadline: true,
        phase: {
          select: { name: true, color: true },
        },
        files: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            source: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            details: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        surveyResponse: {
          select: { token: true, submittedAt: true, answers: true },
        },
        priceEstimate: true,
        verificationRequests: {
          select: {
            token: true,
            status: true,
            sentAt: true,
            type: true,
            resolvedAt: true,
            resolvedBy: true,
          },
          orderBy: { sentAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
    }

    const response = {
      ...order,
      priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
      verificationRequests: order.verificationRequests.map((vr) => ({
        token: vr.token,
        status: vr.status,
        sentAt: vr.sentAt,
        type: vr.type,
        resolvedAt: vr.resolvedAt,
        resolvedBy: vr.resolvedBy,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Order tracking error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
