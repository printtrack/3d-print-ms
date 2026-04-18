import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  buildVolumeX: z.number().int().positive(),
  buildVolumeY: z.number().int().positive(),
  buildVolumeZ: z.number().int().positive(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const machines = await prisma.machine.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { printJobs: true } } },
  });

  return NextResponse.json(machines);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    return NextResponse.json(machine, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
