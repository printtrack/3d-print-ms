import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { assertAdmin } from "@/lib/authz";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "TEAM_MEMBER"]).default("TEAM_MEMBER"),
  teamRoleId: z.string().nullable().optional(),
  restrictedToAssigned: z.boolean().nullable().optional(),
});

export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      teamRoleId: true,
      restrictedToAssigned: true,
      teamRole: { select: { id: true, name: true, color: true, restricted: true } },
      _count: { select: { assignedOrders: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "E-Mail bereits vorhanden" }, { status: 400 });
    }

    if (data.teamRoleId) {
      const exists = await prisma.teamRole.count({ where: { id: data.teamRoleId } });
      if (exists === 0) {
        return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 400 });
      }
    }

    // Members without an explicit role are pinned to the default one rather than
    // left dangling — getActor() would fall back anyway, but storing it keeps the
    // team list honest about what someone actually has.
    const defaultRole =
      data.role === "ADMIN"
        ? null
        : await prisma.teamRole.findFirst({ where: { isDefault: true }, select: { id: true } });

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        teamRoleId:
          data.role === "ADMIN" ? null : (data.teamRoleId ?? defaultRole?.id ?? null),
        restrictedToAssigned: data.restrictedToAssigned ?? null,
      },
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

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
