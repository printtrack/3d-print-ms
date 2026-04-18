import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createCustomerSession, setCustomerSessionCookie } from "@/lib/customer-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (rateLimit(`portal-signin:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { email } });
  const valid = customer ? await bcrypt.compare(password, customer.password) : false;

  if (!customer || !valid) {
    return NextResponse.json({ error: "Ungültige E-Mail oder Passwort" }, { status: 401 });
  }

  const jwt = await createCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
  const response = NextResponse.json({ success: true });
  setCustomerSessionCookie(response, jwt);
  return response;
}
