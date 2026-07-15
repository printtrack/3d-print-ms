import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";
import { PERMISSION_KEYS } from "@/lib/permissions";

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  restricted: z.boolean().optional(),
  permissions: z.array(z.enum(PERMISSION_KEYS)).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  try {
    const data = patchSchema.parse(await req.json());

    const role = await prisma.teamRole.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (data.name && data.name !== role.name) {
      const clash = await prisma.teamRole.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (clash) {
        return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });
      }
    }

    // The system role stays the reliable fallback for members without a role,
    // so it may be re-permissioned but not renamed away or un-defaulted.
    const name = role.isSystem ? role.name : (data.name ?? role.name);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.teamRole.update({
        where: { id },
        data: {
          name,
          description: data.description !== undefined ? data.description : role.description,
          color: data.color ?? role.color,
          restricted: data.restricted ?? role.restricted,
        },
      });

      // Replace the permission set wholesale. In a transaction so a role can
      // never end up with the old rows deleted and the new ones missing.
      if (data.permissions !== undefined) {
        await tx.teamRolePermission.deleteMany({ where: { roleId: id } });
        if (data.permissions.length > 0) {
          await tx.teamRolePermission.createMany({
            data: data.permissions.map((key) => ({ roleId: id, key })),
          });
        }
      }

      return tx.teamRole.findUniqueOrThrow({
        where: { id },
        include: {
          permissions: { select: { key: true } },
          _count: { select: { users: true } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  const role = await prisma.teamRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role.isSystem) {
    return NextResponse.json(
      { error: "Die Standardrolle kann nicht gelöscht werden." },
      { status: 409 },
    );
  }

  // Refuse rather than silently reassign: deleting a role would otherwise move
  // its members onto the default role, quietly widening their rights.
  if (role._count.users > 0) {
    return NextResponse.json(
      {
        error: `Rolle wird noch von ${role._count.users} Mitglied(ern) verwendet. Weise ihnen zuerst eine andere Rolle zu.`,
        memberCount: role._count.users,
      },
      { status: 409 },
    );
  }

  await prisma.teamRole.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
