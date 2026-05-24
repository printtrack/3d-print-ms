import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildBranding, quoteToDocumentData, formatQuoteNumber } from "@/lib/billing-pdf";
import { BillingDocumentPDF } from "@/components/billing/BillingDocumentPDF";
import { getRecipientLocale } from "@/lib/email-locale";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: { id: true, customerEmail: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = await prisma.quote.findFirst({
    where: {
      orderId: order.id,
      status: { in: ["SENT", "APPROVED", "REJECTED"] },
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    include: {
      items: true,
      order: { select: { customerName: true, customerEmail: true } },
    },
  });
  if (!quote) {
    return NextResponse.json({ error: "Kein versendetes Angebot" }, { status: 404 });
  }

  const settings = await getSettings();
  const recipientLocale = await getRecipientLocale(order.customerEmail);
  const locale: "de" | "en" = recipientLocale === "en" ? "en" : "de";
  const branding = await buildBranding(settings);
  if (locale === "en" && settings.billing_footer_en) {
    branding.footer = settings.billing_footer_en;
  }

  const displayNumber =
    quote.number ??
    formatQuoteNumber(settings.quote_number_prefix || "ANG-", new Date().getFullYear(), 0);

  const doc = quoteToDocumentData(
    {
      ...quote,
      items: quote.items.map((i) => ({
        position: i.position,
        description: i.description,
        quantity: Number(i.quantity.toString()),
        unitPriceCents: i.unitPriceCents,
        taxRatePercent: Number(i.taxRatePercent.toString()),
      })),
    },
    displayNumber
  );

  const pdf = await renderToBuffer(
    <BillingDocumentPDF
      kind="quote"
      document={doc}
      branding={branding}
      locale={locale}
    />
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${displayNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
