import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, assertSignedIn } from "@/lib/authz";
import { toPublicMachine } from "@/lib/printers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  buildVolumeX: z.number().int().positive(),
  buildVolumeY: z.number().int().positive(),
  buildVolumeZ: z.number().int().positive(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});


export async function GET() {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const machines = await prisma.machine.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { printJobs: true } },
      downtimes: { orderBy: { startedAt: "desc" }, take: 50 },
    },
  });

  return NextResponse.json(machines.map(toPublicMachine));
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const machine = await prisma.machine.create({
      data: {
        name: data.name,
        buildVolumeX: data.buildVolumeX,
        buildVolumeY: data.buildVolumeY,
        buildVolumeZ: data.buildVolumeZ,
        hourlyRate: data.hourlyRate ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(toPublicMachine(machine), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
