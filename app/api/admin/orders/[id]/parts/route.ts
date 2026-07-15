import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderAccess, assertSignedIn, getActor } from "@/lib/authz";
import { z } from "zod";
import { parseAxis, deriveColorHex } from "@/lib/filament-resolve";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  // Wire format per axis: concrete name | "ANY" (egal) | null (unset)
  material: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  gramsEstimated: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().min(1).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const partInclude = {
  partPhase: { select: { id: true, name: true, color: true, isPrintReady: true } },
  files: {
    include: {
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  printJobParts: {
    include: { printJob: { select: { id: true, status: true, machine: { select: { name: true } } } } },
  },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await assertSignedIn();
  if (guard) return guard;
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
  const { id } = await params;

  const guard = await assertOrderAccess(id, "orders.edit");
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });

    const defaultPartPhase = await prisma.partPhase.findFirst({ where: { isDefault: true } });

    // New parts default to "egal" on both axes (intuitive + immediately plannable).
    const mat = parseAxis(data.material) ?? { concrete: null, any: true };
    const col = parseAxis(data.color) ?? { concrete: null, any: true };
    let colorHex: string | null = null;
    if (col.concrete) {
      const filaments = await prisma.filament.findMany({
        select: { material: true, color: true, colorHex: true },
      });
      colorHex = deriveColorHex(mat.concrete, col.concrete, filaments);
    }

    const part = await prisma.orderPart.create({
      data: {
        orderId: id,
        name: data.name,
        description: data.description ?? null,
        material: mat.concrete,
        materialAny: mat.any,
        color: col.concrete,
        colorAny: col.any,
        colorHex,
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
        userId: (await getActor())?.id ?? null,
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
