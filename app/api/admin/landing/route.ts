import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSignedIn, assertPermission } from "@/lib/authz";
import { BLOCK_TYPES, blockDef } from "@/lib/landing/blocks";
import { getEditorLandingBlocks } from "@/lib/landing/page";

const createSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  /** Insert directly below this block. Omitted → append to the end. */
  afterBlockId: z.string().optional(),
});

export async function GET() {
  // Reading is open to any signed-in member — the editor is visible to all,
  // saving is what `landing.edit` gates.
  const guard = await assertSignedIn();
  if (guard) return guard;

  return NextResponse.json(await getEditorLandingBlocks());
}

export async function POST(req: NextRequest) {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  try {
    const { type, afterBlockId } = createSchema.parse(await req.json());
    const def = blockDef(type);

    if (def.singleton) {
      const existing = await prisma.landingBlock.count({ where: { type } });
      if (existing > 0) {
        return NextResponse.json(
          { error: "Diesen Block gibt es nur einmal pro Seite" },
          { status: 400 },
        );
      }
    }

    const newData = def.schema.parse(def.defaults()) as object;

    if (!afterBlockId) {
      const last = await prisma.landingBlock.findFirst({
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const block = await prisma.landingBlock.create({
        data: {
          type,
          position: (last?.position ?? -1) + 1,
          visible: true,
          // Parsed rather than passed through, so the row is born valid even if
          // a default in the registry drifts away from its schema.
          data: newData,
        },
      });
      return NextResponse.json(block, { status: 201 });
    }

    // Insert below a given block: shift everything after it down by one, then
    // slot the newcomer in. One transaction — a half-applied insert would leave
    // two blocks claiming the same position.
    const anchor = await prisma.landingBlock.findUnique({
      where: { id: afterBlockId },
      select: { position: true },
    });
    if (!anchor) {
      return NextResponse.json({ error: "Block nicht gefunden" }, { status: 404 });
    }

    const [, block] = await prisma.$transaction([
      prisma.landingBlock.updateMany({
        where: { position: { gt: anchor.position } },
        data: { position: { increment: 1 } },
      }),
      prisma.landingBlock.create({
        data: { type, position: anchor.position + 1, visible: true, data: newData },
      }),
    ]);

    return NextResponse.json(block, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
