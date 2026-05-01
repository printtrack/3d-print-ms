import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filamentId: z.string().nullable().optional(),
  gramsEstimated: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).optional(),
  partPhaseId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const partInclude = {
  filament: { select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true } },
  partPhase: { select: { id: true, name: true, color: true, isPrintReady: true } },
  files: true,
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partId } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const currentPart = await prisma.orderPart.findUnique({
      where: { id: partId, orderId: id },
      include: { assignees: { select: { userId: true } } },
    });
    if (!currentPart) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (data.assigneeIds !== undefined) {
      await prisma.orderPartAssignee.deleteMany({ where: { orderPartId: partId } });
      if (data.assigneeIds.length > 0) {
        await prisma.orderPartAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ orderPartId: partId, userId })),
        });
      }
    }

    const part = await prisma.orderPart.update({
      where: { id: partId, orderId: id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.filamentId !== undefined ? { filamentId: data.filamentId } : {}),
        ...(data.gramsEstimated !== undefined ? { gramsEstimated: data.gramsEstimated } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.partPhaseId !== undefined ? { partPhaseId: data.partPhaseId } : {}),
      },
      include: partInclude,
    });

    const userId = (session.user as { id?: string })?.id ?? null;

    if (data.assigneeIds !== undefined) {
      const oldIds = new Set(currentPart.assignees.map((a) => a.userId));
      const newIds = new Set(data.assigneeIds);
      const added = data.assigneeIds.filter((uid) => !oldIds.has(uid));
      const removed = [...oldIds].filter((uid) => !newIds.has(uid));

      if (added.length > 0 || removed.length > 0) {
        const addedUsers = await prisma.user.findMany({ where: { id: { in: added } }, select: { name: true } });
        const removedUsers = await prisma.user.findMany({ where: { id: { in: removed } }, select: { name: true } });
        const parts: string[] = [];
        if (addedUsers.length > 0) parts.push(`Hinzugefügt: ${addedUsers.map((u) => u.name).join(", ")}`);
        if (removedUsers.length > 0) parts.push(`Entfernt: ${removedUsers.map((u) => u.name).join(", ")}`);
        if (newIds.size === 0) { parts.length = 0; parts.push("Zuweisung entfernt"); }

        await prisma.auditLog.create({
          data: {
            orderId: id,
            userId,
            action: "PART_ASSIGNED",
            details: `Teil "${part.name}": ${parts.join("; ")}`,
          },
        });
      }
    } else {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId,
          action: "PART_UPDATED",
          details: `Teil "${part.name}" aktualisiert`,
        },
      });
    }

    return NextResponse.json(part);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partId } = await params;

  const part = await prisma.orderPart.findUnique({ where: { id: partId, orderId: id } });
  if (!part) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.orderPart.delete({ where: { id: partId } });

  await prisma.auditLog.create({
    data: {
      orderId: id,
      userId: (session.user as { id?: string })?.id ?? null,
      action: "PART_REMOVED",
      details: `Teil "${part.name}" entfernt`,
    },
  });

  return NextResponse.json({ success: true });
}
