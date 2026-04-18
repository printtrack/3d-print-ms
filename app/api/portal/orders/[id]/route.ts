import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const customer = await getCustomerSession(req);
  if (!customer) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { phase: true, files: true, auditLogs: true },
  });

  if (!order || order.customerEmail !== customer.email) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const serialized = {
    ...order,
    priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    archivedAt: order.archivedAt?.toISOString() ?? null,
    deadline: order.deadline?.toISOString() ?? null,
    files: order.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    auditLogs: order.auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };

  return NextResponse.json(serialized);
}
