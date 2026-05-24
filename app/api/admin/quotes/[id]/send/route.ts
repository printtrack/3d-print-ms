import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendQuoteEmail } from "@/lib/email";
import { formatQuoteNumber } from "@/lib/billing-pdf";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: true,
      order: {
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          trackingToken: true,
        },
      },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quote.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Nur Entwürfe können gesendet werden." },
      { status: 409 }
    );
  }
  if (quote.items.length === 0) {
    return NextResponse.json(
      { error: "Angebot enthält keine Posten." },
      { status: 400 }
    );
  }

  const orderId = quote.orderId;

  const result = await prisma.$transaction(async (tx) => {
    // Supersede prior open quotes (DRAFT/SENT) for this order other than ours
    await tx.quote.updateMany({
      where: {
        orderId,
        status: { in: ["DRAFT", "SENT"] },
        id: { not: id },
      },
      data: { status: "SUPERSEDED" },
    });

    // Cancel any pending PRICE_APPROVAL verifications that aren't ours
    await tx.verificationRequest.updateMany({
      where: {
        orderId,
        type: "PRICE_APPROVAL",
        status: "PENDING",
        OR: [{ quoteId: null }, { quoteId: { not: id } }],
      },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        rejectionReason: "Ersetzt durch neue Angebotsversion",
      },
    });

    // Allocate quote number on first send (idempotent if already assigned)
    let quoteNumber = quote.number;
    if (!quoteNumber) {
      const year = new Date().getFullYear();
      const prefixSetting = await tx.setting.findUnique({ where: { key: "quote_number_prefix" } });
      const prefix = prefixSetting?.value || "ANG-";

      // Atomic counter via SELECT ... FOR UPDATE on Setting row
      // upsert ensures the row exists before the lock
      await tx.setting.upsert({
        where: { key: "quote_number_next" },
        update: {},
        create: { key: "quote_number_next", value: "1" },
      });
      const locked = await tx.$queryRawUnsafe<Array<{ value: string }>>(
        "SELECT `value` FROM `Setting` WHERE `key` = ? FOR UPDATE",
        "quote_number_next"
      );
      const current = parseInt(locked[0]?.value ?? "1", 10) || 1;
      await tx.setting.update({
        where: { key: "quote_number_next" },
        data: { value: String(current + 1) },
      });
      quoteNumber = formatQuoteNumber(prefix, year, current);
    }

    const updated = await tx.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), number: quoteNumber },
    });

    const vr = await tx.verificationRequest.create({
      data: {
        orderId,
        type: "PRICE_APPROVAL",
        quoteId: id,
      },
    });

    await tx.auditLog.create({
      data: {
        orderId,
        userId: userId ?? null,
        action: "QUOTE_SENT",
        details: `${quoteNumber} versandt (${(updated.totalCents / 100).toFixed(2)} €)`,
      },
    });

    return { vr, totalCents: updated.totalCents, number: quoteNumber };
  });

  sendQuoteEmail({
    customerEmail: quote.order.customerEmail,
    customerName: quote.order.customerName,
    verificationToken: result.vr.token,
    trackingToken: quote.order.trackingToken,
    quoteId: id,
    quoteNumber: result.number,
    totalCents: result.totalCents,
  }).catch((err) => console.error("[email] Quote send email failed:", err));

  return NextResponse.json({
    success: true,
    verificationRequestId: result.vr.id,
    quoteNumber: result.number,
  });
}
