import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { poolKey } from "@/lib/filament-resolve";

const VALID_MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "PC", "Other"] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  material: z.enum(VALID_MATERIALS).optional(),
  color: z.string().min(1).max(100).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")).or(z.null()),
  brand: z.string().max(100).optional().or(z.null()),
  spoolWeightGrams: z.number().int().positive().optional(),
  remainingGrams: z.number().int().min(0).optional(),
  pricePerKg: z.number().positive().optional().or(z.null()),
  notes: z.string().optional().or(z.null()),
  isActive: z.boolean().optional(),
  compatibleMachineIds: z.array(z.string()).optional(),
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
    const { compatibleMachineIds, ...data } = updateSchema.parse(body);

    const filament = await prisma.filament.update({
      where: { id },
      data: {
        ...data,
        colorHex: data.colorHex === "" ? null : data.colorHex,
        ...(compatibleMachineIds !== undefined
          ? { compatibleMachines: { set: compatibleMachineIds.map((mid) => ({ id: mid })) } }
          : {}),
      },
      include: { compatibleMachines: { select: { id: true, name: true } } },
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

  // Parts reference material+color, not a concrete spool. Guard deletion when
  // parts still require this spool's material+color pool.
  const filament = await prisma.filament.findUnique({ where: { id }, select: { material: true, color: true } });
  if (!filament) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const parts = await prisma.orderPart.findMany({
    where: { material: filament.material, color: filament.color },
    select: { id: true },
  });
  // Only block when this is the last spool of that pool.
  const siblingCount = await prisma.filament.count({
    where: { material: filament.material, color: filament.color, id: { not: id } },
  });
  if (parts.length > 0 && siblingCount === 0) {
    return NextResponse.json(
      { error: `Dieses Filament ist noch ${parts.length} Teil(en) zugewiesen und kann nicht gelöscht werden.` },
      { status: 409 }
    );
  }

  await prisma.filament.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
