import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createCustomerSession, setCustomerSessionCookie } from "@/lib/customer-auth";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "E-Mail-Adresse bereits registriert" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const customer = await prisma.customer.create({
    data: { name, email, password: hashedPassword },
  });

  const jwt = await createCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
  const response = NextResponse.json({ success: true });
  setCustomerSessionCookie(response, jwt);
  return response;
}
