import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getOrderFormConfig } from "@/lib/order-form-config";
import { getOrderIntakeConfig } from "@/lib/order-intake";
import { PortalOrderForm } from "@/components/portal/PortalOrderForm";

export default async function NewOrderPage() {
  const customer = await getCustomerSessionFromCookies();
  if (!customer) redirect("/portal/signin");

  const mode = (await getSetting("customer_verification_mode")) ?? "off";
  if (mode !== "off") {
    const customerData = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { emailVerifiedAt: true },
    });
    if (!customerData?.emailVerifiedAt) {
      redirect("/portal?notice=verification-pending");
    }
  }

  // Nothing to submit if the shop accepts no order type from the portal. The
  // dashboard hides its "new order" CTA in that case; this catches deep links.
  const intake = await getOrderIntakeConfig("portal");
  if (!intake.enabled) {
    redirect("/portal");
  }

  const locale = (await getLocale()) === "en" ? "en" : "de";
  const config = await getOrderFormConfig(locale, "portal");
  const t = await getTranslations("portal");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("new_order_title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("new_order_desc")}</p>
      </div>
      <PortalOrderForm
        customerName={customer.name}
        customerEmail={customer.email}
        config={config}
      />
    </div>
  );
}
