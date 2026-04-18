import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: entryId, fileId } = await params;

  const file = await prisma.knowledgeFile.findUnique({ where: { id: fileId } });
  if (!file || file.entryId !== entryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.knowledgeFile.delete({ where: { id: fileId } });

  const filePath = path.join(getUploadDir(), "knowledge", entryId, file.filename);
  await fs.unlink(filePath).catch(() => {});

  return NextResponse.json({ success: true });
}
