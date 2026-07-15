import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/authz";
import { z } from "zod";

const ReorderSchema = z.object({
  phaseId: z.string(),
  orderIds: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  // Permission only, deliberately no assignment check: the payload is the whole
  // column, so every reorder touches other people's cards — scoping it would make
  // sorting impossible for restricted members. Only `phaseOrder` (a view sort
  // index) changes here, never content.
  const guard = await assertPermission("orders.edit");
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { phaseId, orderIds } = parsed.data;

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Validate all orderIds belong to this phase and are not archived
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, phaseId, archivedAt: null },
    select: { id: true },
  });

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "Invalid orderIds" }, { status: 400 });
  }

  await prisma.$transaction(
    orderIds.map((id, index) =>
      prisma.order.update({ where: { id }, data: { phaseOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
