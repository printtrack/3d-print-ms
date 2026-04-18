import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ReorderSchema = z.object({
  phaseId: z.string(),
  orderIds: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
