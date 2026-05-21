import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { PortalOrderList } from "@/components/portal/PortalOrderList";
import { CreditBalanceBanner } from "@/components/portal/CreditBalanceBanner";
import { Button } from "@/components/ui/button";

export default async function PortalPage() {
  const customer = await getCustomerSessionFromCookies();
  if (!customer) redirect("/portal/signin");

  const t = await getTranslations("portal");

  const [orders, customerData] = await Promise.all([
    prisma.order.findMany({
      where: { customerEmail: customer.email },
      include: { phase: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findUnique({
      where: { id: customer.id },
      select: {
        creditBalanceCents: true,
        credits: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, amountCents: true, reason: true, createdAt: true },
        },
      },
    }),
  ]);

  const serialized = orders.map((o) => ({
    ...o,
    priceEstimate: o.priceEstimate ? Number(o.priceEstimate) : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    archivedAt: o.archivedAt?.toISOString() ?? null,
    deadline: o.deadline?.toISOString() ?? null,
  }));

  const recentCredits = (customerData?.credits ?? []).map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("my_orders")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("my_orders_desc", { name: customer.name })}
          </p>
        </div>
        <Link href="/portal/orders/new">
          <Button>{t("new_order_cta")}</Button>
        </Link>
      </div>
      <CreditBalanceBanner
        balanceCents={customerData?.creditBalanceCents ?? 0}
        recentCredits={recentCredits}
      />
      <PortalOrderList orders={serialized} />
    </div>
  );
}
