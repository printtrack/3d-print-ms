import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { is3DModel } from "@/lib/utils";

const CreateNoteSchema = z.object({
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  normalX: z.number(),
  normalY: z.number(),
  normalZ: z.number(),
  body: z.string().min(1).max(2000),
  isCustomerVisible: z.boolean().optional(),
});

type Params = { params: Promise<{ fileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const file = await prisma.orderFile.findUnique({
    where: { id: fileId },
    include: {
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!file) return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });

  return NextResponse.json(
    file.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      resolvedAt: n.resolvedAt?.toISOString() ?? null,
    }))
  );
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const file = await prisma.orderFile.findUnique({
    where: { id: fileId },
    include: { order: { select: { id: true, isPrototype: true } } },
  });

  if (!file) return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  if (!is3DModel(file.filename)) {
    return NextResponse.json({ error: "Nur 3D-Dateien können annotiert werden" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { isCustomerVisible: _ignored, ...rest } = parsed.data;

  const userId = (session.user as { id?: string }).id ?? null;
  const note = await prisma.orderFileNote.create({
    data: {
      orderFileId: fileId,
      ...rest,
      isCustomerVisible: true,
      authorId: userId,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      orderId: file.order.id,
      userId,
      action: "FILE_NOTE_ADDED",
      details: `${file.originalName}: "${parsed.data.body.slice(0, 60)}${parsed.data.body.length > 60 ? "…" : ""}"`,
    },
  });

  return NextResponse.json({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    resolvedAt: note.resolvedAt?.toISOString() ?? null,
  });
}
