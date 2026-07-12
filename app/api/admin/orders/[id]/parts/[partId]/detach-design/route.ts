import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/lib/uploads";

const partInclude = {
  partPhase: { select: { id: true, name: true, color: true, isPrintReady: true, isReview: true, isPrinted: true, isMisprint: true } },
  files: {
    include: {
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  printJobParts: {
    include: { printJob: { select: { id: true, status: true, machine: { select: { name: true } } } } },
  },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

/**
 * Detach a color variant from its shared-design group: copy the group's current
 * DESIGN files onto this part (its own independent copy) and clear
 * variantGroupId, so future design changes no longer affect it.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partId } = await params;

  const part = await prisma.orderPart.findUnique({ where: { id: partId, orderId: id } });
  if (!part) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!part.variantGroupId) {
    return NextResponse.json({ error: "Teil gehört zu keiner Variantengruppe" }, { status: 400 });
  }

  // Shared DESIGN files of the group not already owned by this part.
  const shared = await prisma.orderFile.findMany({
    where: {
      orderId: id,
      category: "DESIGN",
      orderPart: { variantGroupId: part.variantGroupId },
      orderPartId: { not: partId },
    },
  });

  const orderDir = path.join(getUploadDir(), id);
  await mkdir(orderDir, { recursive: true });
  for (const file of shared) {
    const newFilename = `${randomUUID()}${path.extname(file.filename)}`;
    try {
      await copyFile(path.join(orderDir, file.filename), path.join(orderDir, newFilename));
    } catch {
      continue;
    }
    await prisma.orderFile.create({
      data: {
        orderId: id,
        orderPartId: partId,
        filename: newFilename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        source: file.source,
        category: file.category,
      },
    });
  }

  const updated = await prisma.orderPart.update({
    where: { id: partId },
    data: { variantGroupId: null },
    include: partInclude,
  });

  await prisma.auditLog.create({
    data: {
      orderId: id,
      userId: (session.user as { id?: string })?.id ?? null,
      action: "PART_UPDATED",
      details: `Design von Teil "${part.name}" abgekoppelt (eigene Kopie)`,
    },
  });

  return NextResponse.json(updated);
}
