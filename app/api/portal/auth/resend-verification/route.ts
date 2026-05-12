import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { sendCustomerVerificationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (rateLimit(`resend-verify:${ip}`, 3, 60_000)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await getCustomerSession(req);
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const mode = (await getSetting("customer_verification_mode")) ?? "off";
  if (mode !== "email") {
    return NextResponse.json({ error: "E-Mail-Verifikation ist nicht aktiv" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!customer) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (customer.emailVerifiedAt) {
    return NextResponse.json({ error: "Konto ist bereits verifiziert" }, { status: 400 });
  }

  await prisma.customerEmailVerificationToken.deleteMany({ where: { customerId: customer.id } });
  const tokenRecord = await prisma.customerEmailVerificationToken.create({
    data: {
      customerId: customer.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verificationUrl = `${BASE_URL}/api/portal/auth/verify/${tokenRecord.token}`;
  sendCustomerVerificationEmail({
    email: customer.email,
    name: customer.name,
    verificationUrl,
  }).catch((err) => console.error("[email] Resend verification failed:", err));

  return NextResponse.json({ success: true });
}
