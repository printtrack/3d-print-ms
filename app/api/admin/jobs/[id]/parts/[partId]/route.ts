import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: printJobId, partId: orderPartId } = await params;

  const part = await prisma.orderPart.findUnique({ where: { id: orderPartId } });
  if (!part) return NextResponse.json({ error: "Teil nicht gefunden" }, { status: 404 });

  await prisma.printJobPart.delete({
    where: { printJobId_orderPartId: { printJobId, orderPartId } },
  });

  await prisma.auditLog.create({
    data: {
      orderId: part.orderId,
      userId: (session.user as { id?: string })?.id ?? null,
      action: "JOB_REMOVED",
      details: `Teil "${part.name}" vom Druckjob ${printJobId} entfernt`,
    },
  });

  return NextResponse.json({ success: true });
}
