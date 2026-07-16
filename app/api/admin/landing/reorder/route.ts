import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/authz";

const reorderSchema = z.object({
  blockIds: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const { blockIds } = parsed.data;
  if (blockIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // The payload must be the complete page, not a subset: positions are only
  // meaningful relative to each other, and a partial list would silently leave
  // gaps or duplicates behind.
  const all = await prisma.landingBlock.findMany({ select: { id: true } });
  const known = new Set(all.map((b) => b.id));
  const unique = new Set(blockIds);
  if (unique.size !== blockIds.length || blockIds.length !== all.length) {
    return NextResponse.json({ error: "Ungültige Block-IDs" }, { status: 400 });
  }
  if (blockIds.some((id) => !known.has(id))) {
    return NextResponse.json({ error: "Ungültige Block-IDs" }, { status: 400 });
  }

  // One transaction rather than a PATCH per block: a half-applied reorder would
  // leave the page in an order nobody asked for.
  await prisma.$transaction(
    blockIds.map((id, index) =>
      prisma.landingBlock.update({ where: { id }, data: { position: index } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
