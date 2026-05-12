import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PatchNoteSchema = z.object({
  body: z.string().min(1).max(2000).optional(),
  isCustomerVisible: z.boolean().optional(),
  resolved: z.boolean().optional(),
});

type Params = { params: Promise<{ fileId: string; noteId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await params;
  const note = await prisma.orderFileNote.findUnique({
    where: { id: noteId },
    include: { orderFile: { include: { order: { select: { id: true } } } } },
  });

  if (!note) return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });

  const body = await req.json();
  const parsed = PatchNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { resolved, ...rest } = parsed.data;
  const userId = (session.user as { id?: string }).id ?? null;

  const updated = await prisma.orderFileNote.update({
    where: { id: noteId },
    data: {
      ...rest,
      ...(resolved !== undefined
        ? { resolvedAt: resolved ? new Date() : null }
        : {}),
    },
    include: { author: { select: { id: true, name: true } } },
  });

  if (resolved === true) {
    await prisma.auditLog.create({
      data: {
        orderId: note.orderFile.order.id,
        userId,
        action: "FILE_NOTE_RESOLVED",
        details: `${note.orderFile.originalName}: "${note.body.slice(0, 60)}${note.body.length > 60 ? "…" : ""}"`,
      },
    });
  }

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await params;
  const note = await prisma.orderFileNote.findUnique({
    where: { id: noteId },
    include: { orderFile: { include: { order: { select: { id: true } } } } },
  });

  if (!note) return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });

  const userId = (session.user as { id?: string }).id ?? null;
  await prisma.orderFileNote.delete({ where: { id: noteId } });

  await prisma.auditLog.create({
    data: {
      orderId: note.orderFile.order.id,
      userId,
      action: "FILE_NOTE_DELETED",
      details: `${note.orderFile.originalName}: "${note.body.slice(0, 60)}${note.body.length > 60 ? "…" : ""}"`,
    },
  });

  return NextResponse.json({ ok: true });
}
