import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEnabledFeatures } from "@/lib/features";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { getPoolAvailability, getPartCountByPool } from "@/lib/filament-reservations";
import { poolKey } from "@/lib/filament-resolve";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  if (!(await getEnabledFeatures()).inventory) redirect("/admin");

  const [filaments, poolAvail, partCount, machines] = await Promise.all([
    prisma.filament.findMany({
      include: { compatibleMachines: { select: { id: true, name: true } } },
      orderBy: [{ material: "asc" }, { name: "asc" }],
    }),
    getPoolAvailability(),
    getPartCountByPool(),
    prisma.machine.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const serialized = filaments.map((f) => {
    const key = poolKey(f.material, f.color);
    const pool = poolAvail.get(key);
    return {
      ...f,
      pricePerKg: f.pricePerKg != null ? f.pricePerKg.toString() : null,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      reservedGrams: pool?.reserved ?? 0,
      availableGrams: pool?.available ?? f.remainingGrams,
      partCount: partCount.get(key) ?? 0,
    };
  });

  const userRole = (session.user as { role?: string }).role ?? "TEAM_MEMBER";

  return (
    <div className="p-6">
      <InventoryManager filaments={serialized} machines={machines} userRole={userRole} />
    </div>
  );
}
