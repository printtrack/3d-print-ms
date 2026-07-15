import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/authz";
import fs from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: entryId, fileId } = await params;

  const guard = await assertPermission("knowledge.edit");
  if (guard) return guard;

  const file = await prisma.knowledgeFile.findUnique({ where: { id: fileId } });
  if (!file || file.entryId !== entryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.knowledgeFile.delete({ where: { id: fileId } });

  const filePath = path.join(getUploadDir(), "knowledge", entryId, file.filename);
  await fs.unlink(filePath).catch(() => {});

  return NextResponse.json({ success: true });
}
