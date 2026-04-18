import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { getSetting } from "@/lib/settings";
import { PortalNav } from "@/components/portal/PortalNav";
import { Toaster } from "@/components/ui/sonner";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCustomerSessionFromCookies();
  const companyName = (await getSetting("company_name")) ?? "3D Print CMS";

  return (
    <div className="min-h-screen bg-background">
      <PortalNav companyName={companyName} customerName={customer?.name} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">{children}</main>
      <Toaster />
    </div>
  );
}
