import { Prisma } from "@prisma/client";
import type { Invoice, InvoiceItem, Payment, Quote, QuoteItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  category:
    | "FILAMENT"
    | "HARDWARE"
    | "POST_PROCESSING"
    | "DESIGN"
    | "SHIPPING"
    | "DISCOUNT"
    | "OTHER";
  orderPartId?: string | null;
};

export type PaymentInput = {
  amountCents: number;
  paidAt: Date;
  method: "SEPA" | "CASH" | "PAYPAL" | "CREDIT" | "CARD" | "OTHER";
  reference?: string | null;
  notes?: string | null;
};

function formatInvoiceNumber(prefixTemplate: string, year: number, counter: number): string {
  const prefix = prefixTemplate.replace("{YYYY}", String(year));
  return `${prefix}${String(counter).padStart(4, "0")}`;
}

function resolveYearPrefix(template: string, year: number): string {
  // Template "RG-{YYYY}-" → counter prefix "RG-2026-" (one counter per year)
  return template.replace("{YYYY}", String(year));
}

/**
 * Allocate the next invoice number atomically.
 * Lock the counter row via SELECT ... FOR UPDATE inside a transaction.
 */
export async function getNextInvoiceNumberTx(
  tx: Prisma.TransactionClient,
  prefixTemplate: string,
  year: number
): Promise<string> {
  const prefix = resolveYearPrefix(prefixTemplate, year);
  await tx.invoiceNumberCounter.upsert({
    where: { prefix },
    update: {},
    create: { prefix, nextValue: 1 },
  });
  const locked = await tx.$queryRawUnsafe<Array<{ nextValue: number }>>(
    "SELECT `nextValue` FROM `InvoiceNumberCounter` WHERE `prefix` = ? FOR UPDATE",
    prefix
  );
  const current = locked[0]?.nextValue ?? 1;
  await tx.invoiceNumberCounter.update({
    where: { prefix },
    data: { nextValue: current + 1 },
  });
  return formatInvoiceNumber(prefixTemplate, year, current);
}

export function computeInvoiceTotals(items: InvoiceItemInput[]): {
  totalCents: number;
  taxCents: number;
} {
  let net = 0;
  let tax = 0;
  for (const item of items) {
    const line = Math.round(item.quantity * item.unitPriceCents);
    net += line;
    tax += Math.round((line * item.taxRatePercent) / 100);
  }
  return { totalCents: net + tax, taxCents: tax };
}

/**
 * Transform a quote's items into invoice items.
 *
 * - source=FIXED → 1:1
 * - source=ESTIMATE + orderPartId → replace with summed OrderPartIteration.chargedCents
 * - source=ESTIMATE without orderPartId → keep as-is (fallback)
 * - source=ACTUAL → 1:1
 */
export async function transformQuoteItemsTx(
  tx: Prisma.TransactionClient,
  quote: Quote & { items: QuoteItem[] }
): Promise<InvoiceItemInput[]> {
  const out: InvoiceItemInput[] = [];

  for (const item of quote.items) {
    if (item.source !== "ESTIMATE" || !item.orderPartId) {
      out.push({
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceCents: item.unitPriceCents,
        taxRatePercent: Number(item.taxRatePercent),
        category: item.category,
        orderPartId: item.orderPartId ?? null,
      });
      continue;
    }

    // ESTIMATE with orderPartId → look up real iterations
    const iterations = await tx.orderPartIteration.findMany({
      where: { orderPartId: item.orderPartId },
      select: { gramsActual: true, chargedCents: true, result: true },
    });
    const charged = iterations
      .filter((it) => it.chargedCents != null && it.chargedCents > 0)
      .reduce((sum, it) => sum + (it.chargedCents ?? 0), 0);
    const totalGrams = iterations.reduce((sum, it) => sum + (it.gramsActual ?? 0), 0);

    if (charged > 0) {
      const part = await tx.orderPart.findUnique({
        where: { id: item.orderPartId },
        select: { name: true },
      });
      out.push({
        description: `${part?.name ?? item.description}: ${totalGrams} g`,
        quantity: 1,
        unitPriceCents: charged,
        taxRatePercent: Number(item.taxRatePercent),
        category: item.category,
        orderPartId: item.orderPartId,
      });
    } else {
      // Fallback to original estimate
      out.push({
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceCents: item.unitPriceCents,
        taxRatePercent: Number(item.taxRatePercent),
        category: item.category,
        orderPartId: item.orderPartId,
      });
    }
  }

  return out;
}

/**
 * Create a DRAFT invoice from an approved quote.
 * The number is only allocated when issueInvoice() is called.
 */
export async function createDraftInvoiceFromQuote(
  quoteId: string,
  userId: string | null
): Promise<Invoice & { items: InvoiceItem[] }> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "APPROVED") {
    throw new Error("Only approved quotes can be turned into invoices");
  }

  return prisma.$transaction(async (tx) => {
    const settings = await tx.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const kleinunternehmer = settingsMap.billing_kleinunternehmer === "true";
    const paymentTermDays = parseInt(settingsMap.payment_term_days ?? "14", 10) || 14;

    const items = await transformQuoteItemsTx(tx, quote);
    const totals = computeInvoiceTotals(
      items.map((i) =>
        kleinunternehmer ? { ...i, taxRatePercent: 0 } : i
      )
    );

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + paymentTermDays);

    const invoice = await tx.invoice.create({
      data: {
        orderId: quote.orderId,
        quoteId: quote.id,
        status: "DRAFT",
        dueAt,
        kleinunternehmer,
        totalCents: totals.totalCents,
        taxCents: totals.taxCents,
        createdById: userId,
        items: {
          create: items.map((i, idx) => ({
            position: idx,
            description: i.description,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            taxRatePercent: kleinunternehmer ? 0 : i.taxRatePercent,
            category: i.category,
            orderPartId: i.orderPartId ?? null,
          })),
        },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        orderId: quote.orderId,
        userId: userId ?? null,
        action: "INVOICE_DRAFT_CREATED",
        details: `Rechnungs-Entwurf erstellt (${(invoice.totalCents / 100).toFixed(2)} €)`,
      },
    });

    return invoice;
  });
}

/**
 * Issue a draft invoice — allocate atomic number, freeze snapshot.
 * The caller is responsible for rendering & archiving the PDF after this returns.
 */
export async function issueInvoiceTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string | null
): Promise<Invoice & { items: InvoiceItem[] }> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, order: { select: { customerName: true, customerEmail: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "DRAFT") {
    throw new Error("Only DRAFT invoices can be issued");
  }

  const settings = await tx.setting.findMany();
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const prefixTemplate = settingsMap.invoice_number_prefix || "RG-{YYYY}-";
  const year = new Date().getFullYear();
  const number = await getNextInvoiceNumberTx(tx, prefixTemplate, year);

  const snapshot = {
    branding: {
      companyName: settingsMap.billing_company_name || settingsMap.company_name,
      address: {
        line1: settingsMap.billing_company_address_line1,
        line2: settingsMap.billing_company_address_line2,
        city: settingsMap.billing_company_city,
        country: settingsMap.billing_company_country,
      },
      taxId: settingsMap.billing_tax_id,
      steuerNr: settingsMap.billing_steuer_nr,
      bank: {
        name: settingsMap.billing_bank_name,
        iban: settingsMap.billing_iban,
        bic: settingsMap.billing_bic,
      },
      kleinunternehmer: invoice.kleinunternehmer,
    },
    customer: {
      name: invoice.order.customerName,
      email: invoice.order.customerEmail,
    },
    issuedAt: new Date().toISOString(),
  };

  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "ISSUED",
      number,
      issuedAt: new Date(),
      snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  await tx.auditLog.create({
    data: {
      orderId: invoice.orderId,
      userId: userId ?? null,
      action: "INVOICE_ISSUED",
      details: `${number} ausgestellt (${(updated.totalCents / 100).toFixed(2)} €)`,
    },
  });

  return updated;
}

/**
 * Issue + render PDF + archive + email. High-level helper that wraps issueInvoiceTx.
 * Caller passes a renderPdf callback so this lib stays free of React/PDF imports.
 */
export async function issueInvoiceWithPdf(
  invoiceId: string,
  userId: string | null,
  renderAndArchive: (
    invoice: Invoice & { items: InvoiceItem[] }
  ) => Promise<string | null>
): Promise<Invoice & { items: InvoiceItem[] }> {
  const issued = await prisma.$transaction(async (tx) => issueInvoiceTx(tx, invoiceId, userId));
  const pdfPath = await renderAndArchive(issued);
  if (pdfPath) {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfPath },
      include: { items: { orderBy: { position: "asc" } } },
    });
  }
  return issued;
}

/**
 * Storno an issued invoice — creates a CANCELLED original + new negated invoice (reverseOf link).
 * Paid amounts are NOT auto-refunded; admin must reverse payments manually.
 */
export async function cancelInvoice(
  invoiceId: string,
  userId: string | null
): Promise<{ original: Invoice; storno: Invoice }> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!original) throw new Error("Invoice not found");
    if (original.status === "CANCELLED") {
      throw new Error("Already cancelled");
    }
    if (original.status === "DRAFT") {
      // For drafts: just delete (no number allocated, no audit need)
      await tx.invoice.delete({ where: { id: invoiceId } });
      throw new Error("DRAFT invoices are deleted, not stornoed — use DELETE");
    }

    const settings = await tx.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const prefixTemplate = settingsMap.invoice_number_prefix || "RG-{YYYY}-";
    const year = new Date().getFullYear();
    const stornoNumber = await getNextInvoiceNumberTx(tx, prefixTemplate, year);

    const now = new Date();

    const storno = await tx.invoice.create({
      data: {
        orderId: original.orderId,
        quoteId: original.quoteId,
        number: stornoNumber,
        status: "ISSUED",
        issuedAt: now,
        reverseOfId: original.id,
        totalCents: -original.totalCents,
        taxCents: -original.taxCents,
        kleinunternehmer: original.kleinunternehmer,
        snapshotJson: original.snapshotJson ?? undefined,
        createdById: userId,
        items: {
          create: original.items.map((it) => ({
            position: it.position,
            description: `STORNO: ${it.description}`,
            quantity: it.quantity,
            unitPriceCents: -it.unitPriceCents,
            taxRatePercent: it.taxRatePercent,
            category: it.category,
            orderPartId: it.orderPartId,
          })),
        },
      },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    await tx.auditLog.create({
      data: {
        orderId: original.orderId,
        userId: userId ?? null,
        action: "INVOICE_CANCELLED",
        details: `${original.number} storniert via ${stornoNumber}`,
      },
    });

    return { original: updated, storno };
  });
}

export async function recordPayment(
  invoiceId: string,
  payment: PaymentInput,
  userId: string | null
): Promise<{ payment: Payment; orderId: string; previousStatus: Invoice["status"]; newStatus: Invoice["status"] }> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "CANCELLED") {
      throw new Error("Cannot record payments on cancelled invoices");
    }

    const created = await tx.payment.create({
      data: {
        invoiceId,
        amountCents: payment.amountCents,
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference ?? null,
        notes: payment.notes ?? null,
        recordedBy: userId,
      },
    });

    const allPayments = [...invoice.payments, created];
    const paidSum = allPayments.reduce((s, p) => s + p.amountCents, 0);
    const newStatus = computeStatusForTotals(invoice.totalCents, paidSum, invoice.dueAt);

    if (newStatus !== invoice.status) {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });
    }

    await tx.auditLog.create({
      data: {
        orderId: invoice.orderId,
        userId: userId ?? null,
        action: "PAYMENT_RECORDED",
        details: `Zahlung erfasst: ${(payment.amountCents / 100).toFixed(2)} € via ${payment.method}`,
      },
    });

    return {
      payment: created,
      orderId: invoice.orderId,
      previousStatus: invoice.status,
      newStatus,
    };
  });
}

/**
 * Move the order phase forward when an invoice flips to PAID, or back to
 * "Rechnung offen" when payments are removed and the invoice is no longer PAID.
 * Idempotent — silently does nothing if the target phase is unchanged or the
 * required phases are missing.
 */
export async function syncOrderPhaseFromInvoiceStatus(
  orderId: string,
  newStatus: Invoice["status"],
  userId: string | null
): Promise<void> {
  if (newStatus === "PAID") {
    const done = await prisma.orderPhase.findFirst({ where: { name: "Abgeschlossen" } });
    if (!done) return;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { phaseId: true } });
    if (!order || order.phaseId === done.id) return;
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { phaseId: done.id } }),
      prisma.auditLog.create({
        data: {
          orderId,
          userId,
          action: "PHASE_CHANGED",
          details: "Phase: Abgeschlossen (Rechnung bezahlt)",
        },
      }),
    ]);
    return;
  }

  if (newStatus === "PARTIALLY_PAID" || newStatus === "ISSUED" || newStatus === "OVERDUE") {
    // Reverting from PAID (e.g. payment removed) — move back to "Rechnung offen"
    const invoicePending = await prisma.orderPhase.findFirst({ where: { name: "Rechnung offen" } });
    if (!invoicePending) return;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { phaseId: true } });
    if (!order || order.phaseId === invoicePending.id) return;
    const done = await prisma.orderPhase.findFirst({ where: { name: "Abgeschlossen" } });
    // Only move back if we're currently in "Abgeschlossen" (don't override a manual phase)
    if (done && order.phaseId !== done.id) return;
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { phaseId: invoicePending.id } }),
      prisma.auditLog.create({
        data: {
          orderId,
          userId,
          action: "PHASE_CHANGED",
          details: "Phase: Rechnung offen (Zahlung entfernt, Rechnung wieder offen)",
        },
      }),
    ]);
  }
}

export function computeStatusForTotals(
  totalCents: number,
  paidCents: number,
  dueAt: Date | null
): "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" {
  if (paidCents >= totalCents && totalCents > 0) return "PAID";
  if (paidCents > 0) return "PARTIALLY_PAID";
  if (dueAt && dueAt < new Date()) return "OVERDUE";
  return "ISSUED";
}

export function computeInvoiceStatus(
  invoice: Pick<Invoice, "totalCents" | "dueAt" | "status"> & { payments: Pick<Payment, "amountCents">[] }
): Invoice["status"] {
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") return invoice.status;
  const paid = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
  return computeStatusForTotals(invoice.totalCents, paid, invoice.dueAt);
}

export function paidAmountCents(payments: Pick<Payment, "amountCents">[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}
