import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  if (userRole !== "ADMIN") redirect("/admin");

  const { tab } = await searchParams;

  const [settings, phases, members, machines, partPhases, projectPhases] = await Promise.all([
    getSettings(),
    prisma.orderPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { assignedOrders: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { printJobs: true } } },
    }),
    prisma.partPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { orderParts: true } } },
    }),
    prisma.projectPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    }),
  ]);

  const serializedMembers = members.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  const serializedMachines = machines.map((m) => ({
    ...m,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          System, Team und Workflow konfigurieren
        </p>
      </div>
      <SettingsForm
        initialSettings={settings}
        defaultTab={tab}
        initialPhases={phases}
        initialMembers={serializedMembers}
        currentUserId={session?.user?.id ?? ""}
        initialMachines={serializedMachines}
        initialPartPhases={partPhases}
        initialProjectPhases={projectPhases}
      />
    </div>
  );
}
