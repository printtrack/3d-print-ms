import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildBranding, invoiceToDocumentData, buildSepaQrDataUrl } from "@/lib/billing-pdf";
import { renderInvoicePdf } from "@/lib/billing-render";
import { getRecipientLocale } from "@/lib/email-locale";
import { getUploadDir } from "@/lib/uploads";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: { id: true, customerEmail: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoice = await prisma.invoice.findFirst({
    where: {
      orderId: order.id,
      status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    orderBy: { issuedAt: "desc" },
    include: {
      items: { orderBy: { position: "asc" } },
      order: { select: { customerName: true, customerEmail: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Keine ausgestellte Rechnung" }, { status: 404 });
  }

  if (invoice.pdfPath && invoice.number) {
    try {
      const cleaned = invoice.pdfPath.replace(/^\/+uploads\/+/, "");
      const filePath = path.join(getUploadDir(), cleaned);
      const buf = await readFile(filePath);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      // Fall through to live render
    }
  }

  const settings = await getSettings();
  const rawLocale = await getRecipientLocale(order.customerEmail);
  const locale: "de" | "en" = rawLocale === "en" ? "en" : "de";
  const branding = await buildBranding(settings);
  if (locale === "en" && settings.billing_footer_en) {
    branding.footer = settings.billing_footer_en;
  }
  branding.kleinunternehmer = invoice.kleinunternehmer;

  const displayNumber = invoice.number ?? "RG";
  const doc = invoiceToDocumentData(
    {
      ...invoice,
      items: invoice.items.map((i) => ({
        position: i.position,
        description: i.description,
        quantity: Number(i.quantity.toString()),
        unitPriceCents: i.unitPriceCents,
        taxRatePercent: Number(i.taxRatePercent.toString()),
      })),
    },
    displayNumber
  );

  if (branding.bank.iban && invoice.totalCents > 0 && invoice.number) {
    const qr = await buildSepaQrDataUrl({
      bic: branding.bank.bic,
      beneficiaryName: branding.companyName,
      iban: branding.bank.iban,
      amountCents: invoice.totalCents,
      reference: invoice.number,
    });
    if (qr) doc.sepaQrDataUrl = qr;
  }

  const pdf = await renderInvoicePdf({ document: doc, branding, locale });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${displayNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
