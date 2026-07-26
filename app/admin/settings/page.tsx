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

  const [settings, phases, machines, partPhases, projectPhases, projectFilePhases, subscriptions, roles, filaments] = await Promise.all([
    getSettings(),
    prisma.orderPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { printJobs: true } },
        downtimes: { orderBy: { startedAt: "desc" }, take: 50 },
        filamentSlots: { orderBy: { slot: "asc" }, select: { slot: true, filamentId: true } },
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
    prisma.filament.findMany({
      where: { isActive: true },
      orderBy: [{ material: "asc" }, { color: "asc" }],
      select: { id: true, name: true, material: true, color: true, colorHex: true },
    }),
  ]);

  const serializedMachines = machines.map((m) => ({
    ...m,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    filamentSlots: m.filamentSlots.map((fs) => ({ slot: fs.slot, filamentId: fs.filamentId })),
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
        initialMachines={serializedMachines}
        availableFilaments={filaments}
        initialPartPhases={partPhases}
        initialProjectPhases={projectPhases}
        initialProjectFilePhases={projectFilePhases}
        initialSubscriptions={serializedSubscriptions}
        initialRoles={serializedRoles}
        enabledFeatures={enabledFeatures}
      />
    </div>
  );
}
