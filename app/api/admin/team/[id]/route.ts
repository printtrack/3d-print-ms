import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertAdmin, getActor } from "@/lib/authz";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "TEAM_MEMBER"]).optional(),
  password: z.string().min(6).optional(),
  // null = fall back to the default role
  teamRoleId: z.string().nullable().optional(),
  // null = inherit the role's restriction; true/false override it per member.
  // `.nullable().optional()` on purpose: "not sent" and "set back to inherit"
  // must stay distinguishable.
  restrictedToAssigned: z.boolean().nullable().optional(),
});

/** Refuse changes that would leave the system with no admin at all. */
async function wouldOrphanAdmins(id: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (target?.role !== "ADMIN") return false;
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  return admins <= 1;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, role, password, teamRoleId, restrictedToAssigned } = parsed.data;

  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (existing) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }
  }

  if (role === "TEAM_MEMBER" && (await wouldOrphanAdmins(id))) {
    return NextResponse.json(
      { error: "Der letzte Administrator kann nicht herabgestuft werden." },
      { status: 409 }
    );
  }

  if (teamRoleId) {
    const exists = await prisma.teamRole.count({ where: { id: teamRoleId } });
    if (exists === 0) {
      return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (password !== undefined) updateData.password = await bcrypt.hash(password, 12);
  if (teamRoleId !== undefined) updateData.teamRoleId = teamRoleId;
  if (restrictedToAssigned !== undefined) updateData.restrictedToAssigned = restrictedToAssigned;

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      teamRoleId: true,
      restrictedToAssigned: true,
      teamRole: { select: { id: true, name: true, color: true, restricted: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  // Prevent deleting yourself
  const actor = await getActor();
  if (actor?.id === id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen" },
      { status: 400 }
    );
  }

  if (await wouldOrphanAdmins(id)) {
    return NextResponse.json(
      { error: "Der letzte Administrator kann nicht gelöscht werden." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
