import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { JobsView } from "@/components/admin/JobsView";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const [machines, jobs] = await Promise.all([
    prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.printJob.findMany({
      where: { status: { in: ["PLANNED", "SLICED", "IN_PROGRESS"] } },
      orderBy: [{ machineId: "asc" }, { queuePosition: "asc" }],
      include: {
        machine: { select: { id: true, name: true } },
        parts: {
          include: {
            orderPart: {
              include: {
                order: { select: { id: true, customerName: true, customerEmail: true, description: true } },
                filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
              },
            },
          },
        },
        filamentUsages: {
          include: {
            filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
          },
        },
      },
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
  }));

  // Serialize dates
  const serializedJobs = jobs.map((j) => ({
    ...j,
    plannedAt: j.plannedAt ? j.plannedAt.toISOString() : null,
    startedAt: j.startedAt ? j.startedAt.toISOString() : null,
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
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
      },
    })),
  }));

  return (
    <JobsView
      machines={serializedMachines}
      initialJobs={serializedJobs}
    />
  );
}
