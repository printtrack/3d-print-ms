import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEnabledFeatures } from "@/lib/features";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { getReservedGramsByFilament } from "@/lib/filament-reservations";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  if (!(await getEnabledFeatures()).inventory) redirect("/admin");

  const [filaments, reserved] = await Promise.all([
    prisma.filament.findMany({
      include: { _count: { select: { orderParts: true } } },
      orderBy: [{ material: "asc" }, { name: "asc" }],
    }),
    getReservedGramsByFilament(),
  ]);

  const serialized = filaments.map((f) => {
    const reservedGrams = reserved.get(f.id) ?? 0;
    return {
      ...f,
      pricePerKg: f.pricePerKg != null ? f.pricePerKg.toString() : null,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      reservedGrams,
      availableGrams: f.remainingGrams - reservedGrams,
    };
  });

  const userRole = (session.user as { role?: string }).role ?? "TEAM_MEMBER";

  return (
    <div className="p-6">
      <InventoryManager filaments={serialized} userRole={userRole} />
    </div>
  );
}
