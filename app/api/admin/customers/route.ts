import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      creditBalance: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    customers.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))
  );
}
