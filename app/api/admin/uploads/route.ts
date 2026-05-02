import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".stl", ".obj", ".3mf"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const orderId = formData.get("orderId") as string;
    const partId = (formData.get("partId") as string | null) || null;
    const categoryRaw = formData.get("category") as string | null;
    const category = (["REFERENCE", "DESIGN", "RESULT", "OTHER"].includes(categoryRaw ?? "")
      ? categoryRaw
      : "DESIGN") as "REFERENCE" | "DESIGN" | "RESULT" | "OTHER";

    if (!orderId) {
      return NextResponse.json({ error: "orderId fehlt" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, trackingToken: true, customerName: true, customerEmail: true, isPrototype: true },
    });
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
      if (file.size > MAX_FILE_SIZE) continue;

      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const safeFilename = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, safeFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!validateFileContent(buffer, ext)) continue;
      await writeFile(filePath, buffer);

      const saved = await prisma.orderFile.create({
        data: {
          orderId,
          orderPartId: partId,
          filename: safeFilename,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          source: "TEAM",
          category,
        },
      });

      savedFiles.push(saved);
    }

    if (savedFiles.length > 0) {
      if (partId && category === "DESIGN") {
        const updatedPart = await prisma.orderPart.update({
          where: { id: partId },
          data: { iterationCount: { increment: 1 } },
          select: { iterationCount: true, name: true },
        });
        await prisma.auditLog.create({
          data: {
            orderId,
            userId: session.user.id as string,
            action: "PART_ITERATION_INCREMENTED",
            details: `Teil "${updatedPart.name}" – Iteration #${updatedPart.iterationCount}`,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          orderId,
          userId: session.user.id as string,
          action: "TEAM_FILE_UPLOADED",
          details: `${savedFiles.length} Designdatei(en) vom Team hochgeladen`,
        },
      });

    }

    return NextResponse.json({ files: savedFiles }, { status: 201 });
  } catch (err) {
    console.error("Admin upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
