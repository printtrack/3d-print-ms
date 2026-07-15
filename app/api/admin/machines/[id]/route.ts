import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  buildVolumeX: z.number().int().positive().optional(),
  buildVolumeY: z.number().int().positive().optional(),
  buildVolumeZ: z.number().int().positive().optional(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

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
  const guard = await assertAdmin();
  if (guard) return guard;

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
