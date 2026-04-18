import { redirect } from "next/navigation";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { PortalOrderForm } from "@/components/portal/PortalOrderForm";

export default async function NewOrderPage() {
  const customer = await getCustomerSessionFromCookies();
  if (!customer) redirect("/portal/signin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Neuen Auftrag einreichen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Beschreibe deinen 3D-Druck Auftrag und lade optional Dateien hoch.
        </p>
      </div>
      <PortalOrderForm customerName={customer.name} customerEmail={customer.email} />
    </div>
  );
}
