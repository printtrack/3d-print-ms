import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, assertSignedIn, getActor } from "@/lib/authz";
import { z } from "zod";
import { affectedJobsForDowntime } from "@/lib/machine-downtime";

const createSchema = z.object({
  reason: z.enum(["MAINTENANCE", "DEFECT"]),
  note: z.string().max(2000).nullable().optional(),
  // omit or null → now (immediate outage); a future ISO date → planned maintenance
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const { id } = await params;
  const downtimes = await prisma.machineDowntime.findMany({
    where: { machineId: id },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json(downtimes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;
  const actor = await getActor();

  const { id } = await params;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const machine = await prisma.machine.findUnique({ where: { id } });
    if (!machine) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const startedAt = data.startedAt ? new Date(data.startedAt) : new Date();
    const endedAt = data.endedAt ? new Date(data.endedAt) : null;
    if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
      return NextResponse.json({ error: "Ende muss nach dem Start liegen" }, { status: 400 });
    }

    const downtime = await prisma.machineDowntime.create({
      data: {
        machineId: id,
        reason: data.reason,
        note: data.note ?? null,
        startedAt,
        endedAt,
        createdBy: actor?.id ?? null,
      },
    });

    // Jobs that need rescheduling because of this downtime (drives the assistant).
    const affected = await affectedJobsForDowntime(id, startedAt);

    return NextResponse.json({ downtime, affectedJobs: affected }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
