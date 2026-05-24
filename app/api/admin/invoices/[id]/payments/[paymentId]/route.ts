import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeStatusForTotals, syncOrderPhaseFromInvoiceStatus } from "@/lib/invoices";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id, paymentId } = await params;
  const userId = session.user?.id ?? null;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: {
        include: { payments: true },
      },
    },
  });
  if (!payment || payment.invoiceId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const remaining = payment.invoice.payments.filter((p) => p.id !== paymentId);
  const paidSum = remaining.reduce((s, p) => s + p.amountCents, 0);
  const newStatus = computeStatusForTotals(
    payment.invoice.totalCents,
    paidSum,
    payment.invoice.dueAt
  );
  const previousStatus = payment.invoice.status;

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } });

    if (newStatus !== previousStatus && previousStatus !== "CANCELLED") {
      await tx.invoice.update({
        where: { id },
        data: { status: newStatus },
      });
    }

    await tx.auditLog.create({
      data: {
        orderId: payment.invoice.orderId,
        userId,
        action: "PAYMENT_REMOVED",
        details: `Zahlung über ${(payment.amountCents / 100).toFixed(2)} € entfernt`,
      },
    });
  });

  // Sync order phase outside the transaction
  if (newStatus !== previousStatus && previousStatus !== "CANCELLED") {
    await syncOrderPhaseFromInvoiceStatus(payment.invoice.orderId, newStatus, userId);
  }

  return NextResponse.json({ success: true });
}
