import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(6),
  // Only honoured for unbound invites; a bound invite fixes the address.
  email: z.string().email().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Einladung ungültig." }, { status: 400 });
  if (invite.usedAt) {
    return NextResponse.json({ error: "Diese Einladung wurde bereits verwendet." }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Diese Einladung ist abgelaufen." }, { status: 400 });
  }

  // Bound invites dictate the address; unbound ones require the redeemer to
  // supply one.
  const email = (invite.email ?? parsed.data.email)?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "E-Mail-Adresse erforderlich." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Für diese E-Mail-Adresse existiert bereits ein Teammitglied." },
      { status: 409 }
    );
  }

  // Members without an explicit role are pinned to the default one rather than
  // left dangling — mirrors the direct-create path in /api/admin/team.
  const teamRoleId =
    invite.role === "ADMIN"
      ? null
      : invite.teamRoleId ??
        (await prisma.teamRole.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id ??
        null;

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      // Guarded claim: loses to a concurrent redemption of the same invite,
      // which rolls the whole creation back.
      const claimed = await tx.teamInvite.updateMany({
        where: { token, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("INVITE_ALREADY_USED");

      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          password: hashedPassword,
          role: invite.role,
          teamRoleId,
          restrictedToAssigned: invite.role === "ADMIN" ? null : invite.restrictedToAssigned,
        },
      });

      await tx.teamInvite.update({ where: { token }, data: { usedById: user.id } });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_ALREADY_USED") {
      return NextResponse.json(
        { error: "Diese Einladung wurde bereits verwendet." },
        { status: 400 }
      );
    }
    // Unique-constraint race on email → surface as a clean conflict.
    console.error("Team invite accept error:", err);
    return NextResponse.json(
      { error: "Konto konnte nicht angelegt werden." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, email });
}
