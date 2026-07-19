import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRegistrationMode } from "@/lib/order-intake";
import { CustomerManager } from "@/components/admin/CustomerManager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  if (userRole !== "ADMIN") redirect("/admin");

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      creditBalanceCents: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  const serialized = customers.map((c) => ({
    ...c,
    emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  // With registration closed an invite could not be redeemed — hide the invite
  // option. The mode itself lives in Settings → Auftragsannahme.
  const registrationMode = await getRegistrationMode();

  return (
    <div className="space-y-6">
      <CustomerManager initialCustomers={serialized} canInvite={registrationMode !== "closed"} />
    </div>
  );
}
