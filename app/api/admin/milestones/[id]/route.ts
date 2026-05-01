import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    if (data.dueAt) {
      const dueDate = new Date(data.dueAt);
      const existing = await prisma.milestone.findUnique({
        where: { id },
        select: { orderId: true, projectId: true },
      });
      if (existing?.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: existing.orderId },
          select: { createdAt: true, deadline: true },
        });
        if (order) {
          if (dueDate < order.createdAt) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht vor dem Erstelldatum liegen" }, { status: 422 });
          }
          if (order.deadline && dueDate > order.deadline) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht nach der Deadline liegen" }, { status: 422 });
          }
        }
      } else if (existing?.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: existing.projectId },
          select: { createdAt: true, deadline: true },
        });
        if (project) {
          if (dueDate < project.createdAt) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht vor dem Erstelldatum liegen" }, { status: 422 });
          }
          if (project.deadline && dueDate > project.deadline) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht nach der Deadline liegen" }, { status: 422 });
          }
        }
      }
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.completedAt !== undefined
          ? { completedAt: data.completedAt ? new Date(data.completedAt) : null }
          : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      },
      include: {
        tasks: {
          include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(milestone);
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.milestone.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
