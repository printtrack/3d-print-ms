import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/authz";
import { defaultBlockRows } from "@/lib/landing/defaults";
import { getEditorLandingBlocks } from "@/lib/landing/page";

/**
 * Turn the implicit default page into real, editable rows.
 *
 * Until this runs, the landing page renders lib/landing/defaults.ts and the
 * table is empty — that is what makes the feature invisible to shops that never
 * open the editor. The first admin who wants to change something materializes
 * the same content as rows and edits from there.
 */
export async function POST() {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  // Idempotent for the case that actually happens: a double click, or a second
  // admin opening the editor after the first already initialized it. Two truly
  // simultaneous requests could both pass this check — not worth a lock for a
  // once-per-install action whose worst outcome is a duplicated default page
  // that an admin can delete.
  const existing = await prisma.landingBlock.count();
  if (existing > 0) {
    return NextResponse.json(await getEditorLandingBlocks());
  }

  await prisma.landingBlock.createMany({
    data: defaultBlockRows().map((row) => ({
      type: row.type,
      position: row.position,
      visible: row.visible,
      data: row.data as object,
    })),
  });

  return NextResponse.json(await getEditorLandingBlocks(), { status: 201 });
}
