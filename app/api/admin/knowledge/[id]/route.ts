import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  problem: z.string().min(1).optional(),
  solution: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const entry = await prisma.knowledgeEntry.update({
      where: { id },
      data,
      include: { author: { select: { id: true, name: true } }, files: true },
    });

    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { role?: string };
  if (sessionUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.knowledgeEntry.delete({ where: { id } });

  const uploadDir = path.join(getUploadDir(), "knowledge", id);
  await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {});

  return NextResponse.json({ success: true });
}
