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

// Excludes I (looks like 1) and O (looks like 0) — same convention as IATA airline codes
const SHORT_CODE_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const machineId = searchParams.get("machineId");
  const shortCode = searchParams.get("shortCode");

  const where: Record<string, unknown> = {};
  if (machineId) where.machineId = machineId;
  if (shortCode) {
    const code = shortCode.toUpperCase();
    // Match by shortCode, or fall back to the ID-suffix used on labels for jobs without a shortCode
    where.OR = [
      { shortCode: code },
      { shortCode: null, id: { endsWith: code.toLowerCase() } },
    ];
  }

  const jobs = await prisma.printJob.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
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

    // Generate a unique 6-char alphanumeric short code for plate labeling
    let shortCode: string;
    for (;;) {
      shortCode = generateShortCode();
      const existing = await prisma.printJob.findUnique({ where: { shortCode } });
      if (!existing) break;
    }

    const job = await prisma.printJob.create({
      data: {
        machineId: data.machineId,
        plannedAt: data.plannedAt ? new Date(data.plannedAt) : null,
        notes: data.notes ?? null,
        queuePosition,
        shortCode,
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
