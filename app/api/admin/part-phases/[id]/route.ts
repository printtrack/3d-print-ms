import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";
import { partConditionsSchema } from "@/lib/phase-conditions";

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  isPrintReady: z.boolean().optional(),
  enterGate: partConditionsSchema.optional(),
  autoAdvance: partConditionsSchema.optional(),
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

    if (data.isDefault) {
      await prisma.partPhase.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    if (data.isPrintReady) {
      await prisma.partPhase.updateMany({
        where: { isPrintReady: true, id: { not: id } },
        data: { isPrintReady: false },
      });
    }

    const phase = await prisma.partPhase.update({ where: { id }, data });
    return NextResponse.json(phase);
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
  await prisma.partPhase.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
