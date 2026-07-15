import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
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
      await prisma.projectFilePhase.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const phase = await prisma.projectFilePhase.update({
      where: { id },
      data,
    });

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

  // Files keep existing but lose their phase assignment (onDelete: SetNull)
  await prisma.projectFilePhase.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
