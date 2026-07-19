import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TeamManager } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  if (userRole !== "ADMIN") redirect("/admin");

  const [members, roles] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        teamRoleId: true,
        restrictedToAssigned: true,
        teamRole: { select: { id: true, name: true, color: true, restricted: true } },
        _count: { select: { assignedOrders: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.teamRole.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, restricted: true, isDefault: true },
    }),
  ]);

  const serializedMembers = members.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <TeamManager
        initialMembers={serializedMembers}
        currentUserId={session?.user?.id ?? ""}
        roles={roles}
      />
    </div>
  );
}
