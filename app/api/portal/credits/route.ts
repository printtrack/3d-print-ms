import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const customer = await getCustomerSession(req);
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: {
      creditBalance: true,
      credits: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, reason: true, orderId: true, createdAt: true },
      },
    },
  });

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    creditBalance: data.creditBalance,
    credits: data.credits.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  });
}
