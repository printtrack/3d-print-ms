import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { PortalNav } from "@/components/portal/PortalNav";
import { CustomerVerificationBanner } from "@/components/portal/CustomerVerificationBanner";
import { Toaster } from "@/components/ui/sonner";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSessionFromCookies();
  const companyName = (await getSetting("company_name")) ?? "3D Print CMS";

  let showBanner = false;
  let verificationMode: "admin" | "email" = "admin";

  if (session) {
    const mode = (await getSetting("customer_verification_mode")) ?? "off";
    if (mode === "admin" || mode === "email") {
      const customer = await prisma.customer.findUnique({
        where: { id: session.id },
        select: { emailVerifiedAt: true },
      });
      if (customer && !customer.emailVerifiedAt) {
        showBanner = true;
        verificationMode = mode;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav companyName={companyName} customerName={session?.name} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {showBanner && (
          <div className="mb-6">
            <CustomerVerificationBanner mode={verificationMode} />
          </div>
        )}
        {children}
      </main>
      <Toaster />
    </div>
  );
}
