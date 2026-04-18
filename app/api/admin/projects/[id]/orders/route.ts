import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const linkSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { orderId } = linkSchema.parse(body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
    if (order.projectId && order.projectId !== id) {
      return NextResponse.json(
        { error: "Auftrag ist bereits einem anderen Projekt zugeordnet" },
        { status: 409 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { projectId: id },
      include: {
        phase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await prisma.projectAuditLog.create({
      data: {
        projectId: id,
        userId: session.user?.id ?? null,
        action: "ORDER_LINKED",
        details: order.customerName,
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Link order error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
