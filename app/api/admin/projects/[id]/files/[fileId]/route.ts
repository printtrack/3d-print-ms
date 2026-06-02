import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { z } from "zod";

const patchSchema = z.object({
  phaseId: z.string().nullable().optional(),
}).refine((d) => d.phaseId !== undefined, {
  message: "At least one field required",
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, fileId } = await params;

  try {
    const body = await req.json();
    const { phaseId } = patchSchema.parse(body);

    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, projectId },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.projectFile.update({
      where: { id: fileId },
      data: { ...(phaseId !== undefined && { phaseId }) },
      include: { phase: { select: { id: true, name: true, color: true } } },
    });

    await prisma.projectAuditLog.create({
      data: {
        projectId,
        userId: session.user.id as string,
        action: "FILE_PHASE_CHANGED",
        details: `${file.originalName} → ${updated.phase?.name ?? "ohne Phase"}`,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Project file patch error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, fileId } = await params;

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.projectFile.delete({ where: { id: fileId } });

  const filePath = path.join(getUploadDir(), "projects", projectId, file.filename);
  try {
    await unlink(filePath);
  } catch {
    console.warn(`Could not delete file: ${filePath}`);
  }

  await prisma.projectAuditLog.create({
    data: {
      projectId,
      userId: session.user.id as string,
      action: "FILE_DELETED",
      details: `Datei gelöscht: ${file.originalName}`,
    },
  });

  return NextResponse.json({ success: true });
}
