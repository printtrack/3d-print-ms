import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkJobOverlap } from "@/lib/overlap-check";

const createSchema = z.object({
  machineId: z.string().min(1),
  plannedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const jobInclude = {
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
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const machineId = searchParams.get("machineId");

  const jobs = await prisma.printJob.findMany({
    where: machineId ? { machineId } : undefined,
    orderBy: [{ machineId: "asc" }, { queuePosition: "asc" }],
    include: jobInclude,
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Compute next queue position for this machine
    const last = await prisma.printJob.findFirst({
      where: { machineId: data.machineId },
      orderBy: { queuePosition: "desc" },
    });
    const queuePosition = (last?.queuePosition ?? -1) + 1;

    if (data.plannedAt) {
      const overlap = await checkJobOverlap({
        machineId: data.machineId,
        plannedAt: new Date(data.plannedAt),
        printTimeMinutes: null,
      });
      if (overlap.overlapping) {
        return NextResponse.json(
          { error: "Überschneidung mit einem anderen Druckauftrag", conflictJobId: overlap.conflictJobId },
          { status: 409 }
        );
      }
    }

    const job = await prisma.printJob.create({
      data: {
        machineId: data.machineId,
        plannedAt: data.plannedAt ? new Date(data.plannedAt) : null,
        notes: data.notes ?? null,
        queuePosition,
        ...(data.assigneeIds && data.assigneeIds.length > 0
          ? { assignees: { create: data.assigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: jobInclude,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
