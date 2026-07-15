import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";
import { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

// Managing roles is hard-wired to ADMIN rather than being a permission of its
// own: a "roles.manage" permission would let its holder grant themselves every
// other permission, which is no boundary at all.

const createSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  restricted: z.boolean().optional(),
  permissions: z.array(z.enum(PERMISSION_KEYS)).optional(),
});

export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const roles = await prisma.teamRole.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      permissions: { select: { key: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

  try {
    const data = createSchema.parse(await req.json());

    const existing = await prisma.teamRole.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });
    }

    const last = await prisma.teamRole.findFirst({ orderBy: { position: "desc" } });
    const keys = data.permissions ?? DEFAULT_ROLE_PERMISSIONS;

    const role = await prisma.teamRole.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#6366f1",
        restricted: data.restricted ?? false,
        position: (last?.position ?? -1) + 1,
        permissions: { create: keys.map((key) => ({ key })) },
      },
      include: {
        permissions: { select: { key: true } },
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
