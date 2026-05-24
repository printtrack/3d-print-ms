import { prisma } from "@/lib/db";
import { computeStatusForTotals } from "@/lib/invoices";
import { getSettings } from "@/lib/settings";
import { sendPaymentReminderEmail } from "@/lib/email";

export interface InvoiceTransitionResult {
  invoicesUpdated: number;
  ordersTransitioned: number;
  overdue: number;
  paid: number;
}

/**
 * Sweep all non-CANCELLED invoices and update status fields based on
 * payments + due dates. Side-effects:
 *   - Invoice.status flips to PARTIALLY_PAID / PAID / OVERDUE as appropriate
 *   - Order phase auto-advances to "Rechnung offen" when an invoice is ISSUED
 *     (only forward — never overrides a manual change to a later phase)
 *   - Order phase advances to "Abgeschlossen" when invoice becomes PAID
 *
 * Audit entries are written with userId=null.
 */
export async function runInvoiceAutoTransition(): Promise<InvoiceTransitionResult> {
  const result: InvoiceTransitionResult = {
    invoicesUpdated: 0,
    ordersTransitioned: 0,
    overdue: 0,
    paid: 0,
  };

  const [invoicePendingPhase, doneePhase] = await Promise.all([
    prisma.orderPhase.findFirst({ where: { name: "Rechnung offen" } }),
    prisma.orderPhase.findFirst({ where: { name: "Abgeschlossen" } }),
  ]);

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    include: { payments: true, order: { select: { phaseId: true, id: true } } },
  });

  for (const invoice of invoices) {
    const paidSum = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
    const newStatus = computeStatusForTotals(invoice.totalCents, paidSum, invoice.dueAt);

    if (newStatus !== invoice.status) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: newStatus },
      });
      result.invoicesUpdated++;
      if (newStatus === "OVERDUE") result.overdue++;
      if (newStatus === "PAID") result.paid++;
    }

    // Auto-phase: ISSUED-ish → Rechnung offen (only if not already PAID-ish)
    if (
      invoicePendingPhase &&
      invoice.order.phaseId !== invoicePendingPhase.id &&
      invoice.order.phaseId !== doneePhase?.id &&
      ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(newStatus)
    ) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: invoice.order.id },
          data: { phaseId: invoicePendingPhase.id },
        }),
        prisma.auditLog.create({
          data: {
            orderId: invoice.order.id,
            userId: null,
            action: "PHASE_CHANGED",
            details: "Phase: Rechnung offen (automatisch)",
          },
        }),
      ]);
      result.ordersTransitioned++;
    }

    // Auto-phase: PAID → Abgeschlossen
    if (
      doneePhase &&
      newStatus === "PAID" &&
      invoice.order.phaseId !== doneePhase.id
    ) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: invoice.order.id },
          data: { phaseId: doneePhase.id },
        }),
        prisma.auditLog.create({
          data: {
            orderId: invoice.order.id,
            userId: null,
            action: "PHASE_CHANGED",
            details: "Phase: Abgeschlossen (Rechnung bezahlt)",
          },
        }),
      ]);
      result.ordersTransitioned++;
    }
  }

  return result;
}

export interface ReminderResult {
  remindersSent: number;
  byStage: { 0: number; 1: number; 2: number; 3: number };
}

/**
 * Determine the highest reminder stage an invoice qualifies for *right now*.
 * Stage 0 = pre-due reminder, 1 = first nudge after due, 2 = 1st Mahnung, 3 = 2nd Mahnung.
 * Returns null if no reminder is due yet.
 */
export function computeReminderStage(
  dueAt: Date | null,
  now: Date,
  thresholds: {
    daysBefore: number;
    daysAfter1: number;
    daysAfter2: number;
    daysAfter3: number;
  }
): 0 | 1 | 2 | 3 | null {
  if (!dueAt) return null;
  const msPerDay = 86_400_000;
  const diffDays = Math.floor((now.getTime() - dueAt.getTime()) / msPerDay);
  if (diffDays >= thresholds.daysAfter3) return 3;
  if (diffDays >= thresholds.daysAfter2) return 2;
  if (diffDays >= thresholds.daysAfter1) return 1;
  if (diffDays >= -thresholds.daysBefore && diffDays < 0) return 0;
  return null;
}

/**
 * Walk all open invoices and send the next-due payment reminder where appropriate.
 * Each reminder stage is sent at most once per invoice — uses PaymentReminder rows
 * as the de-dup ledger.
 */
export async function runPaymentReminders(now: Date = new Date()): Promise<ReminderResult> {
  const result: ReminderResult = {
    remindersSent: 0,
    byStage: { 0: 0, 1: 0, 2: 0, 3: 0 },
  };

  const settings = await getSettings();
  if (settings.payment_reminders_enabled !== "true") return result;

  const thresholds = {
    daysBefore: parseInt(settings.payment_reminder_days_before ?? "3", 10) || 3,
    daysAfter1: parseInt(settings.payment_reminder_days_after_1 ?? "7", 10) || 7,
    daysAfter2: parseInt(settings.payment_reminder_days_after_2 ?? "21", 10) || 21,
    daysAfter3: parseInt(settings.payment_reminder_days_after_3 ?? "42", 10) || 42,
  };
  const feeStage2 = parseInt(settings.payment_reminder_fee_2_cents ?? "500", 10) || 0;
  const feeStage3 = parseInt(settings.payment_reminder_fee_3_cents ?? "1000", 10) || 0;

  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    include: {
      payments: true,
      reminders: true,
      order: { select: { id: true, customerEmail: true, customerName: true } },
    },
  });

  for (const inv of candidates) {
    if (!inv.number) continue; // not yet issued (defensive)
    const stage = computeReminderStage(inv.dueAt, now, thresholds);
    if (stage === null) continue;
    if (inv.reminders.some((r) => r.stage === stage)) continue;

    const paidSum = inv.payments.reduce((s, p) => s + p.amountCents, 0);
    if (paidSum >= inv.totalCents) continue; // already paid

    const outstanding = Math.max(inv.totalCents - paidSum, 0);
    const feeCents = stage === 2 ? feeStage2 : stage === 3 ? feeStage3 : 0;

    await prisma.$transaction([
      prisma.paymentReminder.create({
        data: { invoiceId: inv.id, stage, feeCents, sentAt: now },
      }),
      prisma.auditLog.create({
        data: {
          orderId: inv.order.id,
          userId: null,
          action: "REMINDER_SENT",
          details:
            stage === 0
              ? `Zahlungserinnerung (Pre-Fällig) für ${inv.number} verschickt`
              : stage === 1
                ? `Zahlungserinnerung für ${inv.number} verschickt`
                : `${stage - 1}. Mahnung für ${inv.number} verschickt${feeCents > 0 ? ` (Gebühr ${(feeCents / 100).toFixed(2)} €)` : ""}`,
        },
      }),
    ]);

    // Mail outside transaction so SMTP failures don't roll back the ledger entry
    sendPaymentReminderEmail({
      customerEmail: inv.order.customerEmail,
      customerName: inv.order.customerName,
      invoiceNumber: inv.number,
      stage,
      totalCents: inv.totalCents,
      outstandingCents: outstanding,
      feeCents,
      dueAt: inv.dueAt,
    }).catch((err) => console.error("[reminder] mail failed:", err));

    result.remindersSent++;
    result.byStage[stage]++;
  }

  return result;
}
