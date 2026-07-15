import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createCustomerSession, setCustomerSessionCookie } from "@/lib/customer-auth";
import { getSetting } from "@/lib/settings";
import { getRegistrationMode } from "@/lib/order-intake";
import { sendCustomerVerificationEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  inviteToken: z.string().optional(),
});

type InviteCheck =
  | { ok: true; invite: { token: string; email: string | null } | null }
  | { ok: false; error: string; status: number };

async function checkInvite(token: string, email: string): Promise<InviteCheck> {
  const invite = await prisma.customerInvite.findUnique({ where: { token } });
  if (!invite) return { ok: false, error: "Einladung ungültig.", status: 400 };
  if (invite.usedAt) return { ok: false, error: "Diese Einladung wurde bereits verwendet.", status: 400 };
  if (invite.expiresAt < new Date()) return { ok: false, error: "Diese Einladung ist abgelaufen.", status: 400 };
  if (invite.email && invite.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "Diese Einladung gilt für eine andere E-Mail-Adresse.", status: 400 };
  }
  return { ok: true, invite };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const { name, email, password, inviteToken } = parsed.data;

  const registrationMode = await getRegistrationMode();
  if (registrationMode === "closed") {
    return NextResponse.json(
      { error: "Die Registrierung ist derzeit deaktiviert." },
      { status: 403 }
    );
  }
  if (registrationMode === "invite" && !inviteToken) {
    return NextResponse.json(
      { error: "Ein Konto kann nur über eine Einladung angelegt werden." },
      { status: 403 }
    );
  }

  // An invite is honoured in "open" mode too — it was issued deliberately, so it
  // should still be consumed (and still vouch for the address).
  let invite: { token: string; email: string | null } | null = null;
  if (inviteToken) {
    const check = await checkInvite(inviteToken, email);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    invite = check.invite;
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "E-Mail-Adresse bereits registriert" },
      { status: 409 }
    );
  }

  const mode = (await getSetting("customer_verification_mode")) ?? "off";
  // Receiving an address-bound invite already proves control of that mailbox,
  // and issuing it was an admin decision — no second check needed.
  const inviteVouchesForEmail = Boolean(invite?.email);
  const emailVerifiedAt = mode === "off" || inviteVouchesForEmail ? new Date() : null;

  const hashedPassword = await bcrypt.hash(password, 10);

  let customer: { id: string; email: string; name: string };
  try {
    customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: { name, email, password: hashedPassword, emailVerifiedAt },
      });
      if (invite) {
        // Guarded update: loses to a concurrent redemption of the same invite,
        // which rolls the whole registration back.
        const claimed = await tx.customerInvite.updateMany({
          where: { token: invite.token, usedAt: null },
          data: { usedAt: new Date(), usedById: created.id },
        });
        if (claimed.count === 0) throw new Error("INVITE_ALREADY_USED");
      }
      return created;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_ALREADY_USED") {
      return NextResponse.json(
        { error: "Diese Einladung wurde bereits verwendet." },
        { status: 400 }
      );
    }
    throw err;
  }

  const requiresVerification = mode !== "off" && !emailVerifiedAt;
  if (requiresVerification && mode === "email") {
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
  const response = NextResponse.json({ success: true, requiresVerification });
  setCustomerSessionCookie(response, jwt);
  return response;
}
