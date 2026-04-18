import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/lib/uploads";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateFileContent } from "@/lib/file-validation";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "model/stl",
  "application/octet-stream",
]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".stl", ".obj", ".3mf"]);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (rateLimit(`uploads:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const formData = await req.formData();
    const orderId = formData.get("orderId") as string;

    if (!orderId) {
      return NextResponse.json({ error: "orderId fehlt" }, { status: 400 });
    }

    // Verify order exists
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
    }

    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien gefunden" }, { status: 400 });
    }

    const uploadDir = path.join(getUploadDir(), orderId);
    await mkdir(uploadDir, { recursive: true });

    const savedFiles = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        continue; // Skip oversized files
      }

      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        continue; // Skip disallowed extensions
      }

      const safeFilename = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, safeFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!validateFileContent(buffer, ext)) {
        continue; // Skip files whose magic bytes don't match their extension
      }
      await writeFile(filePath, buffer);

      const saved = await prisma.orderFile.create({
        data: {
          orderId,
          filename: safeFilename,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          source: "CUSTOMER",
        },
      });

      savedFiles.push(saved);
    }

    // Create audit log
    if (savedFiles.length > 0) {
      await prisma.auditLog.create({
        data: {
          orderId,
          action: "FILE_UPLOADED",
          details: `${savedFiles.length} Datei(en) hochgeladen`,
        },
      });
    }

    return NextResponse.json({ files: savedFiles }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
