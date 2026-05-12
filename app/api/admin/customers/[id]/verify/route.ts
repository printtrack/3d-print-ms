import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const schema = z.object({ verified: z.boolean() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.customer.update({
    where: { id },
    data: { emailVerifiedAt: parsed.data.verified ? new Date() : null },
    select: { id: true, emailVerifiedAt: true },
  });

  return NextResponse.json({
    id: updated.id,
    emailVerifiedAt: updated.emailVerifiedAt?.toISOString() ?? null,
  });
}
