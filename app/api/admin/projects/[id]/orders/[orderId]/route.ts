import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.projectId !== id) {
    return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { projectId: null },
  });

  await prisma.projectAuditLog.create({
    data: {
      projectId: id,
      userId: session.user?.id ?? null,
      action: "ORDER_UNLINKED",
      details: order.customerName,
    },
  });

  return NextResponse.json({ ok: true });
}
