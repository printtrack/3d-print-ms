import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, getActor } from "@/lib/authz";
import { z } from "zod";
import { INVITE_TTL_DAYS } from "@/lib/order-intake";
import { sendCustomerInviteEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

const createSchema = z.object({
  // Omitted → unbound invite: a link anyone may redeem, no mail is sent.
  email: z.string().email().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const invites = await prisma.customerInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(invites);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;
  const actor = await getActor();

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const email = data.email?.trim().toLowerCase() || null;

    if (email) {
      const existing = await prisma.customer.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "Für diese E-Mail-Adresse existiert bereits ein Konto." },
          { status: 409 }
        );
      }
    }

    const invite = await prisma.customerInvite.create({
      data: {
        email,
        note: data.note?.trim() || null,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdById: actor?.id ?? null,
      },
      include: { createdBy: { select: { name: true } } },
    });

    if (email) {
      sendCustomerInviteEmail({
        email,
        inviteUrl: `${BASE_URL}/portal/register?invite=${invite.token}`,
        expiresInDays: INVITE_TTL_DAYS,
      }).catch((err) => console.error("[email] Customer invite failed:", err));
    }

    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: err.issues }, { status: 400 });
    }
    console.error("Invite creation error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
