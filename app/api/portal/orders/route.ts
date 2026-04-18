import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const customer = await getCustomerSession(req);
  if (!customer) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerEmail: customer.email },
    include: { phase: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = orders.map((o) => ({
    ...o,
    priceEstimate: o.priceEstimate ? Number(o.priceEstimate) : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    archivedAt: o.archivedAt?.toISOString() ?? null,
    deadline: o.deadline?.toISOString() ?? null,
  }));

  return NextResponse.json(serialized);
}
