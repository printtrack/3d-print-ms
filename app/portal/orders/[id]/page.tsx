import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { PortalOrderDetail } from "@/components/portal/PortalOrderDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getEnabledFeatures } from "@/lib/features";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalOrderDetailPage({ params }: PageProps) {
  const customer = await getCustomerSessionFromCookies();
  if (!customer) redirect("/portal/signin");

  const features = await getEnabledFeatures();

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      phase: true,
      files: {
        include: {
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
      },
      auditLogs: { orderBy: { createdAt: "desc" } },
      verificationRequests: { orderBy: { sentAt: "desc" } },
      surveyResponse: true,
      quotes: {
        where: { status: { in: ["SENT", "APPROVED", "REJECTED"] } },
        orderBy: { version: "desc" },
        take: 1,
        include: { items: { orderBy: { position: "asc" } } },
      },
      invoices: {
        where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] } },
        orderBy: { issuedAt: "desc" },
        take: 1,
        include: { payments: { select: { amountCents: true } } },
      },
    },
  });

  if (!order || order.customerEmail !== customer.email) {
    notFound();
  }

  const serialized = {
    ...order,
    priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    archivedAt: order.archivedAt?.toISOString() ?? null,
    deadline: order.deadline?.toISOString() ?? null,
    files: order.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      notes: order.isPrototype
        ? []
        : f.notes.map((n) => ({
            ...n,
            resolvedAt: n.resolvedAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
          })),
    })),
    auditLogs: order.auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    verificationRequests: order.verificationRequests.map((vr) => ({
      token: vr.token,
      status: vr.status,
      sentAt: vr.sentAt.toISOString(),
      resolvedAt: vr.resolvedAt?.toISOString() ?? null,
      type: vr.type,
    })),
    surveyResponse: order.surveyResponse
      ? {
          token: order.surveyResponse.token,
          sentAt: order.surveyResponse.sentAt.toISOString(),
          submittedAt: order.surveyResponse.submittedAt?.toISOString() ?? null,
        }
      : null,
    activeQuote: features.quotes && order.quotes[0]
      ? {
          id: order.quotes[0].id,
          number: order.quotes[0].number ?? null,
          version: order.quotes[0].version,
          status: order.quotes[0].status as "SENT" | "APPROVED" | "REJECTED",
          totalCents: order.quotes[0].totalCents,
          taxCents: order.quotes[0].taxCents,
          validUntil: order.quotes[0].validUntil?.toISOString() ?? null,
          sentAt: order.quotes[0].sentAt?.toISOString() ?? null,
          approvedAt: order.quotes[0].approvedAt?.toISOString() ?? null,
          rejectedAt: order.quotes[0].rejectedAt?.toISOString() ?? null,
          rejectionReason: order.quotes[0].rejectionReason ?? null,
          notes: order.quotes[0].notes ?? null,
          items: order.quotes[0].items.map((it) => ({
            id: it.id,
            description: it.description,
            quantity: Number(it.quantity),
            unitPriceCents: it.unitPriceCents,
            taxRatePercent: Number(it.taxRatePercent),
            category: it.category as string,
            source: it.source as "ESTIMATE" | "FIXED" | "ACTUAL",
          })),
        }
      : null,
    activeInvoice: await (async () => {
      if (!features.invoices) return null;
      const inv = order.invoices[0];
      if (!inv || !inv.number) return null;
      const settings = await getSettings();
      const paid = inv.payments.reduce((s, p) => s + p.amountCents, 0);
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status as "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE",
        totalCents: inv.totalCents,
        taxCents: inv.taxCents,
        paidCents: paid,
        remainingCents: Math.max(inv.totalCents - paid, 0),
        issuedAt: (inv.issuedAt ?? inv.createdAt).toISOString(),
        dueAt: inv.dueAt?.toISOString() ?? null,
        kleinunternehmer: inv.kleinunternehmer,
        bank: {
          name: settings.billing_bank_name ?? "",
          iban: settings.billing_iban ?? "",
          bic: settings.billing_bic ?? "",
        },
      };
    })(),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Meine Aufträge
          </Button>
        </Link>
      </div>
      <PortalOrderDetail order={serialized} />
    </div>
  );
}
