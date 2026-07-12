import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";
import { affectedJobsForDowntime } from "@/lib/machine-downtime";

const createSchema = z.object({
  reason: z.enum(["MAINTENANCE", "DEFECT"]),
  note: z.string().max(2000).nullable().optional(),
  // omit or null → now (immediate outage); a future ISO date → planned maintenance
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
        createdBy: (session.user as { id?: string })?.id ?? null,
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
