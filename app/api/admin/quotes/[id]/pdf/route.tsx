import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildBranding, quoteToDocumentData, formatQuoteNumber } from "@/lib/billing-pdf";
import { BillingDocumentPDF } from "@/components/billing/BillingDocumentPDF";
import { getRecipientLocale } from "@/lib/email-locale";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: true,
      order: { select: { customerName: true, customerEmail: true } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getSettings();
  const recipientLocale = await getRecipientLocale(quote.order.customerEmail);
  const locale: "de" | "en" = recipientLocale === "en" ? "en" : "de";
  const branding = await buildBranding(settings);
  if (locale === "en" && settings.billing_footer_en) {
    branding.footer = settings.billing_footer_en;
  }

  // Use existing number or generate a preview number for drafts
  const displayNumber =
    quote.number ??
    formatQuoteNumber(
      settings.quote_number_prefix || "ANG-",
      new Date().getFullYear(),
      0
    ) + "-DRAFT";

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
