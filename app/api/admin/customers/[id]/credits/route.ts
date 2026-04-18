import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, { message: "Amount must be non-zero" }),
  reason: z.string().min(1).max(500),
  orderId: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, creditBalance: true },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const credits = await prisma.filamentCredit.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    creditBalance: customer.creditBalance,
    credits: credits.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { amount, reason, orderId } = parsed.data;

  const [credit] = await prisma.$transaction([
    prisma.filamentCredit.create({
      data: { customerId: id, amount, reason, orderId, performedBy: userId },
    }),
    prisma.customer.update({
      where: { id },
      data: { creditBalance: { increment: amount } },
    }),
  ]);

  return NextResponse.json({ ...credit, createdAt: credit.createdAt.toISOString() });
}
