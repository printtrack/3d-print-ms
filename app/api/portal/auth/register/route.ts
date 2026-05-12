import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createCustomerSession, setCustomerSessionCookie } from "@/lib/customer-auth";
import { getSetting } from "@/lib/settings";
import { sendCustomerVerificationEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

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

  const mode = (await getSetting("customer_verification_mode")) ?? "off";
  const emailVerifiedAt = mode === "off" ? new Date() : null;

  const hashedPassword = await bcrypt.hash(password, 10);
  const customer = await prisma.customer.create({
    data: { name, email, password: hashedPassword, emailVerifiedAt },
  });

  if (mode === "email") {
    const tokenRecord = await prisma.customerEmailVerificationToken.create({
      data: {
        customerId: customer.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const verificationUrl = `${BASE_URL}/api/portal/auth/verify/${tokenRecord.token}`;
    sendCustomerVerificationEmail({ email, name, verificationUrl }).catch((err) =>
      console.error("[email] Customer verification email failed:", err)
    );
  }

  const jwt = await createCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
  const response = NextResponse.json({ success: true, requiresVerification: mode !== "off" });
  setCustomerSessionCookie(response, jwt);
  return response;
}
