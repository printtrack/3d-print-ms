import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";

const orderSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  description: z.string().min(10),
  deadline: z.string().datetime().nullable().optional(),
  accessCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (rateLimit(`orders:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const body = await req.json();
    const data = orderSchema.parse(body);

    // Access code gate
    const accessCodeEnabled = (await getSetting("access_code_enabled")) === "true";
    if (accessCodeEnabled) {
      const expectedCode = (await getSetting("access_code")) ?? "";
      if (!data.accessCode || data.accessCode.trim() !== expectedCode.trim()) {
        return NextResponse.json(
          { error: "Ungültiger Zugangscode" },
          { status: 403 }
        );
      }
    }

    // Find the default phase
    const defaultPhase = await prisma.orderPhase.findFirst({
      where: { isDefault: true },
      orderBy: { position: "asc" },
    });

    if (!defaultPhase) {
      const firstPhase = await prisma.orderPhase.findFirst({
        orderBy: { position: "asc" },
      });
      if (!firstPhase) {
        return NextResponse.json(
          { error: "Keine Phasen konfiguriert" },
          { status: 500 }
        );
      }
    }

    const phase = defaultPhase ?? (await prisma.orderPhase.findFirst({ orderBy: { position: "asc" } }));

    const order = await prisma.order.create({
      data: {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        description: data.description,
        phaseId: phase!.id,
        ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: "ORDER_CREATED",
        details: `Auftrag von ${data.customerName} eingereicht`,
      },
    });

    // Send confirmation email (non-blocking)
    sendOrderConfirmationEmail({
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      trackingToken: order.trackingToken,
    }).catch((err) => console.error("[email] Order confirmation failed:", err));

    return NextResponse.json(
      { orderId: order.id, trackingToken: order.trackingToken },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabe", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
