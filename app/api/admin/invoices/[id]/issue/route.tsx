import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueInvoiceWithPdf } from "@/lib/invoices";
import { renderInvoicePdf } from "@/lib/billing-render";
import { archiveInvoicePdf } from "@/lib/billing-archive";
import { buildBranding, invoiceToDocumentData, buildSepaQrDataUrl } from "@/lib/billing-pdf";
import { getSettings } from "@/lib/settings";
import { getRecipientLocale } from "@/lib/email-locale";
import { sendInvoiceEmail } from "@/lib/email";
import { assertFeature } from "@/lib/features";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await assertFeature("invoices");
  if (guard) return guard;

  const { id } = await params;
  const userId = session.user?.id ?? null;

  try {
    const settings = await getSettings();

    const issued = await issueInvoiceWithPdf(id, userId, async (invoice) => {
      const fullInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: { orderBy: { position: "asc" } },
          order: { select: { customerName: true, customerEmail: true } },
        },
      });
      if (!fullInvoice || !invoice.number) return null;

      const rawLocale = await getRecipientLocale(fullInvoice.order.customerEmail);
      const locale: "de" | "en" = rawLocale === "en" ? "en" : "de";
      const branding = await buildBranding(settings);
      if (locale === "en" && settings.billing_footer_en) {
        branding.footer = settings.billing_footer_en;
      }

      const doc = invoiceToDocumentData(
        {
          ...fullInvoice,
          items: fullInvoice.items.map((i) => ({
            position: i.position,
            description: i.description,
            quantity: Number(i.quantity.toString()),
            unitPriceCents: i.unitPriceCents,
            taxRatePercent: Number(i.taxRatePercent.toString()),
          })),
        },
        invoice.number
      );

      // Attach SEPA QR for non-zero positive invoices with IBAN
      if (branding.bank.iban && fullInvoice.totalCents > 0) {
        const qr = await buildSepaQrDataUrl({
          bic: branding.bank.bic,
          beneficiaryName: branding.companyName,
          iban: branding.bank.iban,
          amountCents: fullInvoice.totalCents,
          reference: invoice.number,
        });
        if (qr) doc.sepaQrDataUrl = qr;
      }

      const pdf = await renderInvoicePdf({ document: doc, branding, locale });
      const archivedPath = await archiveInvoicePdf(invoice.number, pdf);

      // Send mail with PDF attachment (non-blocking)
      sendInvoiceEmail({
        customerEmail: fullInvoice.order.customerEmail,
        customerName: fullInvoice.order.customerName,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        totalCents: fullInvoice.totalCents,
        dueAt: fullInvoice.dueAt,
        pdfBuffer: pdf,
      }).catch((err) => console.error("[email] Invoice send failed:", err));

      return archivedPath;
    });

    // Trigger phase transition to "Rechnung offen"
    await transitionOrderToInvoicePending(issued.orderId, userId);

    return NextResponse.json(issued);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Invoice issue error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

async function transitionOrderToInvoicePending(orderId: string, userId: string | null) {
  const phase = await prisma.orderPhase.findFirst({ where: { name: "Rechnung offen" } });
  if (!phase) return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { phaseId: true } });
  if (!order || order.phaseId === phase.id) return;
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { phaseId: phase.id } }),
    prisma.auditLog.create({
      data: {
        orderId,
        userId,
        action: "PHASE_CHANGED",
        details: "Phase: Rechnung offen (automatisch nach Rechnungs-Versand)",
      },
    }),
  ]);
}
