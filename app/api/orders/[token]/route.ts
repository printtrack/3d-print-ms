import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { visibleTrackingActions } from "@/lib/tracking-timeline";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { trackingToken: token },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        deadline: true,
        phase: {
          select: { name: true, color: true },
        },
        orderType: true,
        sourceLinks: {
          select: { id: true, url: true, label: true },
          orderBy: { createdAt: "asc" },
        },
        isPrototype: true,
        files: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            source: true,
            category: true,
            orderPartId: true,
            createdAt: true,
            notes: {
              select: {
                id: true,
                posX: true,
                posY: true,
                posZ: true,
                normalX: true,
                normalY: true,
                normalZ: true,
                body: true,
                resolvedAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        parts: {
          select: {
            id: true,
            name: true,
            files: {
              select: {
                filename: true,
                originalName: true,
                category: true,
                orderPartId: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            details: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        surveyResponse: {
          select: { token: true, submittedAt: true, answers: true },
        },
        priceEstimate: true,
        verificationRequests: {
          select: {
            token: true,
            status: true,
            sentAt: true,
            type: true,
            resolvedAt: true,
            resolvedBy: true,
            orderPartId: true,
            quoteId: true,
            rejectionReason: true,
          },
          orderBy: { sentAt: "desc" },
        },
        quotes: {
          where: { status: { in: ["SENT", "APPROVED", "REJECTED"] } },
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            number: true,
            version: true,
            status: true,
            totalCents: true,
            taxCents: true,
            validUntil: true,
            sentAt: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            notes: true,
            items: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPriceCents: true,
                taxRatePercent: true,
                category: true,
                source: true,
              },
            },
          },
        },
        invoices: {
          where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] } },
          orderBy: { issuedAt: "desc" },
          take: 1,
          select: {
            id: true,
            number: true,
            status: true,
            totalCents: true,
            taxCents: true,
            kleinunternehmer: true,
            issuedAt: true,
            dueAt: true,
            payments: { select: { amountCents: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
    }

    const settings = await getSettings();
    const invoiceRaw = order.invoices[0] ?? null;
    const paidCents = invoiceRaw ? invoiceRaw.payments.reduce((s, p) => s + p.amountCents, 0) : 0;

    const { quotes: _quotes, invoices: _invoices, ...orderRest } = order;
    void _quotes;
    void _invoices;

    // Only curated, customer-relevant audit actions ever reach the browser.
    // Internal actions (team assignment, jobs, internal comments, …) are filtered
    // server-side and never serialized into the response.
    const visibleActions = visibleTrackingActions(settings);
    const auditLogs = order.auditLogs.filter((l) => visibleActions.has(l.action));

    const response = {
      ...orderRest,
      auditLogs,
      priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
      files: order.files.map((f) => ({
        ...f,
        notes: order.isPrototype ? [] : f.notes,
      })),
      verificationRequests: order.verificationRequests.map((vr) => ({
        token: vr.token,
        status: vr.status,
        sentAt: vr.sentAt,
        type: vr.type,
        resolvedAt: vr.resolvedAt,
        resolvedBy: vr.resolvedBy,
        orderPartId: vr.orderPartId ?? null,
        quoteId: vr.quoteId ?? null,
        rejectionReason: vr.rejectionReason ?? null,
      })),
      activeQuote: order.quotes[0]
        ? {
            ...order.quotes[0],
            items: order.quotes[0].items.map((it) => ({
              ...it,
              quantity: Number(it.quantity),
              taxRatePercent: Number(it.taxRatePercent),
            })),
          }
        : null,
      activeInvoice:
        invoiceRaw && invoiceRaw.number
          ? {
              id: invoiceRaw.id,
              number: invoiceRaw.number,
              status: invoiceRaw.status,
              totalCents: invoiceRaw.totalCents,
              taxCents: invoiceRaw.taxCents,
              paidCents,
              remainingCents: Math.max(invoiceRaw.totalCents - paidCents, 0),
              issuedAt: invoiceRaw.issuedAt ? invoiceRaw.issuedAt.toISOString() : null,
              dueAt: invoiceRaw.dueAt ? invoiceRaw.dueAt.toISOString() : null,
              kleinunternehmer: invoiceRaw.kleinunternehmer,
              bank: {
                name: settings.billing_bank_name ?? "",
                iban: settings.billing_iban ?? "",
                bic: settings.billing_bic ?? "",
              },
            }
          : null,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Order tracking error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
