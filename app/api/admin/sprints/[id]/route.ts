import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderOrProjectAccess } from "@/lib/authz";
import { scopeOfSprint } from "@/lib/authz-resolve";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scope = await scopeOfSprint(id);
  if (!scope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderOrProjectAccess(scope, { order: "orders.edit", project: "projects.edit" });
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const sprint = await prisma.sprint.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      },
      include: {
        milestones: {
          orderBy: { dueAt: "asc" },
          include: {
            tasks: {
              include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json(sprint);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scope = await scopeOfSprint(id);
  if (!scope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderOrProjectAccess(scope, { order: "orders.edit", project: "projects.edit" });
  if (guard) return guard;

  await prisma.sprint.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
