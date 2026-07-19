import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, getActor } from "@/lib/authz";
import { z } from "zod";
import { INVITE_TTL_DAYS } from "@/lib/order-intake";
import { sendTeamInviteEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

const createSchema = z.object({
  // Omitted → unbound invite: a link anyone may redeem, no mail is sent.
  email: z.string().email().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  role: z.enum(["ADMIN", "TEAM_MEMBER"]).default("TEAM_MEMBER"),
  teamRoleId: z.string().nullable().optional(),
  restrictedToAssigned: z.boolean().nullable().optional(),
});

export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const invites = await prisma.teamInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true } },
    },
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
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "Für diese E-Mail-Adresse existiert bereits ein Teammitglied." },
          { status: 409 }
        );
      }
    }

    if (data.role === "TEAM_MEMBER" && data.teamRoleId) {
      const exists = await prisma.teamRole.count({ where: { id: data.teamRoleId } });
      if (exists === 0) {
        return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 400 });
      }
    }

    // Admins bypass every permission, so a team role or restriction on them would
    // only be misleading — drop it here rather than at redemption time.
    const teamRoleId = data.role === "ADMIN" ? null : (data.teamRoleId ?? null);
    const restrictedToAssigned =
      data.role === "ADMIN" ? null : (data.restrictedToAssigned ?? null);

    const invite = await prisma.teamInvite.create({
      data: {
        email,
        note: data.note?.trim() || null,
        role: data.role,
        teamRoleId,
        restrictedToAssigned,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdById: actor?.id ?? null,
      },
      include: { createdBy: { select: { name: true } } },
    });

    if (email) {
      sendTeamInviteEmail({
        email,
        inviteUrl: `${BASE_URL}/auth/accept-invite?token=${invite.token}`,
        expiresInDays: INVITE_TTL_DAYS,
      }).catch((err) => console.error("[email] Team invite failed:", err));
    }

    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: err.issues }, { status: 400 });
    }
    console.error("Team invite creation error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
