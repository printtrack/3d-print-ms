import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const record = await prisma.customerEmailVerificationToken.findUnique({
    where: { token },
    include: { customer: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!record || record.expires < new Date()) {
    if (record) {
      await prisma.customerEmailVerificationToken.delete({ where: { token } });
    }
    return NextResponse.redirect(`${BASE_URL}/portal/verify-error`);
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: record.customerId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.customerEmailVerificationToken.delete({ where: { token } }),
  ]);

  return NextResponse.redirect(`${BASE_URL}/portal?verified=1`);
}
