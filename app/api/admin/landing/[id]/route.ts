import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/authz";
import { blockDef, isBlockType } from "@/lib/landing/blocks";

const patchSchema = z.object({
  visible: z.boolean().optional(),
  data: z.unknown().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  const { id } = await params;

  try {
    const patch = patchSchema.parse(await req.json());

    const existing = await prisma.landingBlock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Block nicht gefunden" }, { status: 404 });
    }
    if (!isBlockType(existing.type)) {
      return NextResponse.json({ error: "Unbekannter Blocktyp" }, { status: 400 });
    }

    const update: { visible?: boolean; data?: object } = {};

    if (patch.visible !== undefined) update.visible = patch.visible;

    if (patch.data !== undefined) {
      // The block's own schema is the validator — the client may not write shapes
      // the renderer cannot read.
      const parsed = blockDef(existing.type).schema.safeParse(patch.data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
      }
      update.data = parsed.data as object;
    }

    const block = await prisma.landingBlock.update({ where: { id }, data: update });
    return NextResponse.json(block);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  const { id } = await params;

  const existing = await prisma.landingBlock.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Block nicht gefunden" }, { status: 404 });
  }

  // Locked blocks (the order form) own anchors the rest of the page links to.
  // They can be hidden, which is the reversible version of what a delete would
  // do here, but not removed.
  if (isBlockType(existing.type) && blockDef(existing.type).locked) {
    return NextResponse.json(
      { error: "Dieser Block kann nicht gelöscht werden — blende ihn stattdessen aus" },
      { status: 400 },
    );
  }

  await prisma.landingBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
