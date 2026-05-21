import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Session } from "next-auth";

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      creditBalanceCents: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    customers.map((c) => ({
      ...c,
      emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  creditBalanceCents: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.issues }, { status: 400 });
  }

  const { name, email, password, creditBalanceCents } = parsed.data;

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-Mail-Adresse bereits vergeben" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const customer = await prisma.customer.create({
    data: {
      name,
      email,
      password: hashedPassword,
      creditBalanceCents: creditBalanceCents ?? 0,
      emailVerifiedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      creditBalanceCents: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json(
    {
      ...customer,
      emailVerifiedAt: customer.emailVerifiedAt?.toISOString() ?? null,
      createdAt: customer.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
