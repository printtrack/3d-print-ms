import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";


const schema = z.object({ verified: z.boolean() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
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
