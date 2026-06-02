import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
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

  const [{ tab }, t] = await Promise.all([searchParams, getTranslations("admin")]);

  const [settings, phases, members, machines, partPhases, projectPhases, projectFilePhases] = await Promise.all([
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
    prisma.projectFilePhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { files: true } } },
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
      />
    </div>
  );
}
