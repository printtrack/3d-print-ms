import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { getCustomerSession } from "@/lib/customer-auth";

const orderSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  description: z.string().min(10),
  deadline: z.string().datetime().nullable().optional(),
  accessCode: z.string().optional(),
  orderType: z.enum(["PRINT_ONLY", "DESIGN"]).default("PRINT_ONLY"),
  sourceLinks: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        label: z.string().max(200).optional(),
      })
    )
    .max(20)
    .optional(),
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

    // Customer session: attach FK and check verification
    let customerId: string | undefined;
    const customerSession = await getCustomerSession(req);
    if (customerSession) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerSession.id },
        select: { id: true, emailVerifiedAt: true },
      });
      if (customer) {
        const mode = (await getSetting("customer_verification_mode")) ?? "off";
        if (mode !== "off" && !customer.emailVerifiedAt) {
          return NextResponse.json(
            { error: "Dein Konto wurde noch nicht freigeschalten. Bitte warte auf die Bestätigung, bevor du eine Bestellung aufgibst." },
            { status: 403 }
          );
        }
        customerId = customer.id;
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

    // Only PRINT_ONLY orders carry source links
    const sourceLinks =
      data.orderType === "PRINT_ONLY"
        ? (data.sourceLinks ?? []).filter((l) => l.url.trim().length > 0)
        : [];

    const order = await prisma.order.create({
      data: {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        description: data.description,
        phaseId: phase!.id,
        orderType: data.orderType,
        ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
        ...(customerId ? { customerId } : {}),
        ...(sourceLinks.length > 0
          ? {
              sourceLinks: {
                create: sourceLinks.map((l) => ({
                  url: l.url.trim(),
                  label: l.label?.trim() || null,
                })),
              },
            }
          : {}),
      },
    });

    // Create audit log
    const typeLabel = data.orderType === "PRINT_ONLY" ? "Nur Druck" : "Design benötigt";
    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: "ORDER_CREATED",
        details: `Auftrag von ${data.customerName} eingereicht (${typeLabel}${sourceLinks.length > 0 ? `, ${sourceLinks.length} Quell-Link(s)` : ""})`,
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
