import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Session } from "next-auth";

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.issues }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  if (!name && !email && !password) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  if (email) {
    const conflict = await prisma.customer.findFirst({ where: { email, NOT: { id } } });
    if (conflict) {
      return NextResponse.json({ error: "E-Mail-Adresse bereits vergeben" }, { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (password) updateData.password = await bcrypt.hash(password, 12);

  const customer = await prisma.customer.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      creditBalance: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json({
    ...customer,
    emailVerifiedAt: customer.emailVerifiedAt?.toISOString() ?? null,
    createdAt: customer.createdAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
