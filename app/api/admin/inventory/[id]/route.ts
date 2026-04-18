import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const VALID_MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "PC", "Other"] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  material: z.enum(VALID_MATERIALS).optional(),
  color: z.string().min(1).max(100).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")).or(z.null()),
  brand: z.string().max(100).optional().or(z.null()),
  spoolWeightGrams: z.number().int().positive().optional(),
  remainingGrams: z.number().int().min(0).optional(),
  notes: z.string().optional().or(z.null()),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const filament = await prisma.filament.update({
      where: { id },
      data: {
        ...data,
        colorHex: data.colorHex === "" ? null : data.colorHex,
      },
      include: { _count: { select: { orderParts: true } } },
    });

    return NextResponse.json(filament);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const count = await prisma.orderPart.count({ where: { filamentId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Dieses Filament ist noch ${count} Auftrag/Aufträgen zugewiesen und kann nicht gelöscht werden.` },
      { status: 409 }
    );
  }

  await prisma.filament.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
