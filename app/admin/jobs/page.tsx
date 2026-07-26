import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEnabledFeatures } from "@/lib/features";
import { resolveFilamentForPart } from "@/lib/filament-resolve";
import { runAutoPlanExclusive } from "@/lib/job-auto-plan";
import { getAttendanceConfig } from "@/lib/attendance-server";
import type { SkippedPart } from "@/lib/job-planner";
import { TutorialAwareJobsView } from "@/components/admin/tutorial/TutorialAwareJobsView";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  if (!(await getEnabledFeatures()).jobs) redirect("/admin");

  // Batch print-ready parts into jobs before reading — the board is always up
  // to date without a click. When those jobs print is decided separately
  // (drag on the timeline or the "auto-schedule" button).
  let skippedParts: SkippedPart[] = [];
  try {
    skippedParts = (await runAutoPlanExclusive((session.user as { id?: string })?.id ?? null)).skipped;
  } catch {
    // planning is best-effort — never block the board
  }

  const [attendance, machines, jobs, users, inventory] = await Promise.all([
    getAttendanceConfig(),
    prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        downtimes: { orderBy: { startedAt: "desc" }, take: 50 },
        filamentSlots: {
          orderBy: { slot: "asc" },
          include: { filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } } },
        },
      },
    }),
    prisma.printJob.findMany({
      where: { status: { in: ["PLANNED", "SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION"] } },
      orderBy: [{ machineId: "asc" }, { queuePosition: "asc" }],
      include: {
        machine: { select: { id: true, name: true } },
        parts: {
          include: {
            orderPart: {
              include: {
                order: { select: { id: true, customerName: true, customerEmail: true, description: true } },
              },
            },
          },
        },
        filamentUsages: {
          include: {
            filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
          },
        },
        plannedFilaments: {
          include: {
            filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
          },
        },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.filament.findMany({
      select: { material: true, color: true, isActive: true, remainingGrams: true, pricePerKg: true },
    }),
  ]);

  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
        <Cpu className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <h2 className="text-lg font-semibold">Keine Maschinen konfiguriert</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Füge zuerst Drucker hinzu, um den Job-Queue zu nutzen.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/machines">Maschinen verwalten</Link>
        </Button>
      </div>
    );
  }

  // Serialize Decimal + dates
  const serializedMachines = machines.map((m) => ({
    ...m,
    hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    filamentSlots: m.filamentSlots.map((fs) => ({
      slot: fs.slot,
      filamentId: fs.filamentId,
      label: fs.filament ? `${fs.filament.material} ${fs.filament.color}` : null,
      colorHex: fs.filament?.colorHex ?? null,
    })),
    downtimes: m.downtimes.map((d) => ({
      id: d.id,
      reason: d.reason,
      startedAt: d.startedAt.toISOString(),
      endedAt: d.endedAt ? d.endedAt.toISOString() : null,
    })),
  }));

  // Serialize dates
  const serializedJobs = jobs.map((j) => ({
    ...j,
    plannedAt: j.plannedAt ? j.plannedAt.toISOString() : null,
    startedAt: j.startedAt ? j.startedAt.toISOString() : null,
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    filamentChangeConfirmedAt: j.filamentChangeConfirmedAt ? j.filamentChangeConfirmedAt.toISOString() : null,
    plannedFilaments: j.plannedFilaments.map((pf) => ({
      filamentId: pf.filamentId,
      label: `${pf.filament.material} ${pf.filament.color}`,
      colorHex: pf.filament.colorHex,
    })),
    filamentUsages: j.filamentUsages.map((fu) => ({
      ...fu,
      createdAt: fu.createdAt.toISOString(),
    })),
    parts: j.parts.map((p) => ({
      ...p,
      addedAt: p.addedAt.toISOString(),
      orderPart: {
        ...p.orderPart,
        createdAt: p.orderPart.createdAt.toISOString(),
        updatedAt: p.orderPart.updatedAt.toISOString(),
        // Resolve the concrete spool price for the verify cost preview.
        pricePerKg: (() => {
          const r = resolveFilamentForPart(p.orderPart, inventory);
          return r?.pricePerKg != null ? r.pricePerKg.toString() : null;
        })(),
      },
    })),
  }));

  return (
    <TutorialAwareJobsView
      machines={serializedMachines}
      initialJobs={serializedJobs}
      teamMembers={users}
      initialSkipped={skippedParts}
      attendance={attendance}
    />
  );
}
