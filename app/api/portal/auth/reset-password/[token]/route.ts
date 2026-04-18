import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const schema = z.object({ password: z.string().min(6) });

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: "Link ungültig oder abgelaufen" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: record.email } });
  if (!customer) {
    return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  await prisma.customer.update({ where: { id: customer.id }, data: { password: hashed } });
  await prisma.passwordResetToken.delete({ where: { token } });

  return NextResponse.json({ success: true });
}
