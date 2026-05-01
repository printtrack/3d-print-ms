import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  filamentId: z.string().optional().nullable(),
  gramsEstimated: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().min(1).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const partInclude = {
  filament: { select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true } },
  partPhase: { select: { id: true, name: true, color: true, isPrintReady: true } },
  files: true,
  printJobParts: {
    include: { printJob: { select: { id: true, status: true, machine: { select: { name: true } } } } },
  },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parts = await prisma.orderPart.findMany({
    where: { orderId: id },
    include: partInclude,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(parts);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });

    const defaultPartPhase = await prisma.partPhase.findFirst({ where: { isDefault: true } });

    const part = await prisma.orderPart.create({
      data: {
        orderId: id,
        name: data.name,
        description: data.description ?? null,
        filamentId: data.filamentId ?? null,
        gramsEstimated: data.gramsEstimated ?? null,
        quantity: data.quantity ?? 1,
        partPhaseId: defaultPartPhase?.id ?? null,
        ...(data.assigneeIds && data.assigneeIds.length > 0
          ? { assignees: { create: data.assigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: partInclude,
    });

    await prisma.auditLog.create({
      data: {
        orderId: id,
        userId: (session.user as { id?: string })?.id ?? null,
        action: "PART_ADDED",
        details: `Teil "${data.name}" hinzugefügt`,
      },
    });

    return NextResponse.json(part, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
