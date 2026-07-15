import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getEnabledFeatures } from "@/lib/features";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
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

  const [{ tab }, t, enabledFeatures] = await Promise.all([
    searchParams,
    getTranslations("admin"),
    getEnabledFeatures(),
  ]);

  const [settings, phases, members, machines, partPhases, projectPhases, projectFilePhases, subscriptions, roles] = await Promise.all([
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
        teamRoleId: true,
        restrictedToAssigned: true,
        teamRole: { select: { id: true, name: true, color: true, restricted: true } },
        _count: { select: { assignedOrders: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { printJobs: true } },
        downtimes: { orderBy: { startedAt: "desc" }, take: 50 },
      },
    }),
    prisma.partPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { orderParts: true } } },
    }),
    prisma.projectPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    }),
    prisma.projectFilePhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { files: true } } },
    }),
    prisma.calendarSubscription.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.teamRole.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        permissions: { select: { key: true } },
        _count: { select: { users: true } },
      },
    }),
  ]);

  const serializedMembers = members.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  const roleOptions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    restricted: r.restricted,
    isDefault: r.isDefault,
  }));

  const serializedMachines = machines.map((m) => ({
    ...m,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    downtimes: m.downtimes.map((d) => ({
      id: d.id,
      reason: d.reason,
      note: d.note,
      startedAt: d.startedAt.toISOString(),
      endedAt: d.endedAt ? d.endedAt.toISOString() : null,
    })),
  }));

  // TeamRole carries Dates the client form never reads — drop them rather than
  // serialise noise across the boundary.
  const serializedRoles = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isSystem: r.isSystem,
    isDefault: r.isDefault,
    restricted: r.restricted,
    permissions: r.permissions,
    _count: r._count,
  }));

  const serializedSubscriptions = subscriptions.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    color: s.color,
    isActive: s.isActive,
    lastFetchedAt: s.lastFetchedAt ? s.lastFetchedAt.toISOString() : null,
    lastError: s.lastError,
  }));

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings_title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("settings_desc")}
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
        initialProjectFilePhases={projectFilePhases}
        initialSubscriptions={serializedSubscriptions}
        initialRoles={serializedRoles}
        roleOptions={roleOptions}
        enabledFeatures={enabledFeatures}
      />
    </div>
  );
}
