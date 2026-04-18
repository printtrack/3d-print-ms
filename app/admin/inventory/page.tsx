import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { InventoryManager } from "@/components/admin/InventoryManager";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const filaments = await prisma.filament.findMany({
    include: { _count: { select: { orderParts: true } } },
    orderBy: [{ material: "asc" }, { name: "asc" }],
  });

  const serialized = filaments.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  const userRole = (session.user as { role?: string }).role ?? "TEAM_MEMBER";

  return (
    <div className="p-6">
      <InventoryManager filaments={serialized} userRole={userRole} />
    </div>
  );
}
