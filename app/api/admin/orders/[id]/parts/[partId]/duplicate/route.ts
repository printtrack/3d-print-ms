import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { randomUUID } from "crypto";

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

/**
 * Duplicate a part as a color variant. Variants of the same object **share one
 * design** via `variantGroupId`: uploading a new STL to any member updates all
 * of them. The color is reset so the operator picks a new one. A variant can
 * later be detached (see the detach-design route) to get its own copy.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const { id, partId } = await params;

  const guard = await assertOrderAccess(id, "orders.edit");
  if (guard) return guard;

  const source = await prisma.orderPart.findUnique({ where: { id: partId, orderId: id } });
  if (!source) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Ensure the source belongs to a variant group; the clone joins the same one.
  let groupId = source.variantGroupId;
  if (!groupId) {
    groupId = randomUUID();
    await prisma.orderPart.update({ where: { id: source.id }, data: { variantGroupId: groupId } });
  }

  const defaultPartPhase = await prisma.partPhase.findFirst({ where: { isDefault: true } });

  const clone = await prisma.orderPart.create({
    data: {
      orderId: id,
      name: source.name,
      description: source.description,
      material: source.material,
      materialAny: source.materialAny,
      // Color reset to "egal" — the operator picks the variant's color next.
      color: null,
      colorAny: true,
      colorHex: null,
      variantGroupId: groupId,
      gramsEstimated: source.gramsEstimated,
      quantity: source.quantity,
      partPhaseId: defaultPartPhase?.id ?? null,
    },
    include: partInclude,
  });

  await prisma.auditLog.create({
    data: {
      orderId: id,
      userId: (await getActor())?.id ?? null,
      action: "PART_ADDED",
      details: `Teil "${source.name}" als Farbvariante dupliziert (geteiltes Design)`,
    },
  });

  // Attach the shared design files so the new variant shows the STL immediately.
  const sharedDesign = await prisma.orderFile.findMany({
    where: { orderId: id, category: "DESIGN", orderPart: { variantGroupId: groupId } },
    include: {
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ ...clone, files: sharedDesign }, { status: 201 });
}
