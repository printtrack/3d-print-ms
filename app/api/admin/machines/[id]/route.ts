import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  buildVolumeX: z.number().int().positive().optional(),
  buildVolumeY: z.number().int().positive().optional(),
  buildVolumeZ: z.number().int().positive().optional(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const machine = await prisma.machine.update({
      where: { id },
      data,
    });

    return NextResponse.json(machine);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const activeJobs = await prisma.printJob.count({
    where: { machineId: id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
  });
  if (activeJobs > 0) {
    return NextResponse.json(
      { error: "Maschine kann nicht gelöscht werden – hat noch aktive Druckjobs" },
      { status: 400 }
    );
  }

  await prisma.machine.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
