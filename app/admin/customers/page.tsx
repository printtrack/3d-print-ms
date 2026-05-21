import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
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

  return <CustomerManager initialCustomers={serialized} />;
}
