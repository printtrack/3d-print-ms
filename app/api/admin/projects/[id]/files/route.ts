import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".stl", ".obj", ".3mf", ".pdf",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    const formData = await req.formData();
    const phaseIdRaw = (formData.get("phaseId") as string | null) || null;

    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien gefunden" }, { status: 400 });
    }

    // Resolve the phase to assign: explicit phaseId, otherwise the default phase
    let phaseId = phaseIdRaw;
    if (!phaseId) {
      const defaultPhase = await prisma.projectFilePhase.findFirst({
        where: { isDefault: true },
        orderBy: { position: "asc" },
      });
      phaseId = defaultPhase?.id ?? null;
    }

    const uploadDir = path.join(getUploadDir(), "projects", projectId);
    await mkdir(uploadDir, { recursive: true });

    const savedFiles = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) continue;

      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const safeFilename = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, safeFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!validateFileContent(buffer, ext)) continue;
      await writeFile(filePath, buffer);

      const saved = await prisma.projectFile.create({
        data: {
          projectId,
          phaseId,
          filename: safeFilename,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        },
        include: { phase: { select: { id: true, name: true, color: true } } },
      });

      savedFiles.push(saved);
    }

    if (savedFiles.length === 0) {
      return NextResponse.json({ error: "Keine gültige Datei hochgeladen" }, { status: 400 });
    }

    await prisma.projectAuditLog.create({
      data: {
        projectId,
        userId: session.user.id as string,
        action: "FILE_UPLOADED",
        details: `${savedFiles.length} Datei(en) hochgeladen`,
      },
    });

    return NextResponse.json({ files: savedFiles }, { status: 201 });
  } catch (err) {
    console.error("Project upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
