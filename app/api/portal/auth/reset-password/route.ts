import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendCustomerPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: true }); // no enumeration
  }

  const { email } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { email } });

  if (customer) {
    // Delete any existing token for this email
    await prisma.passwordResetToken.deleteMany({ where: { email } });

    const record = await prisma.passwordResetToken.create({
      data: {
        email,
        expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const resetUrl = `${BASE_URL}/portal/reset-password/${record.token}`;
    await sendCustomerPasswordResetEmail({ email, name: customer.name, resetUrl }).catch(
      (err) => console.error("[portal/reset-password] email error:", err)
    );
  }

  return NextResponse.json({ success: true });
}
