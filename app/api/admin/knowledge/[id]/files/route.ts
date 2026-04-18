import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: entryId } = await params;

  const entry = await prisma.knowledgeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const rawFiles = formData.getAll("files");

  const uploadDir = path.join(getUploadDir(), "knowledge", entryId);
  await fs.mkdir(uploadDir, { recursive: true });

  const created = [];

  for (const raw of rawFiles) {
    if (!(raw instanceof File)) continue;

    const ext = ALLOWED_TYPES[raw.type];
    if (!ext) {
      return NextResponse.json(
        { error: `Dateityp nicht erlaubt: ${raw.type}` },
        { status: 400 }
      );
    }
    if (raw.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Datei zu groß (max 20 MB): ${raw.name}` },
        { status: 400 }
      );
    }

    const filename = randomUUID() + ext;
    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await raw.arrayBuffer());
    if (!validateFileContent(buffer, ext)) {
      return NextResponse.json(
        { error: `Dateiinhalt entspricht nicht dem erwarteten Format: ${raw.name}` },
        { status: 400 }
      );
    }
    await fs.writeFile(filePath, buffer);

    const record = await prisma.knowledgeFile.create({
      data: {
        entryId,
        filename,
        originalName: raw.name,
        mimeType: raw.type,
        size: raw.size,
      },
    });
    created.push(record);
  }

  return NextResponse.json({ files: created }, { status: 201 });
}
