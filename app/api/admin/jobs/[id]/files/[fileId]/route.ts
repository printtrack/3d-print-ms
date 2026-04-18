import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, fileId } = await params;

  const file = await prisma.printJobFile.findFirst({
    where: { id: fileId, printJobId: id },
  });
  if (!file) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Delete from disk
  const filePath = path.join(getUploadDir(), "jobs", id, file.filename);
  try {
    await unlink(filePath);
  } catch {
    // File may already be gone — proceed with DB deletion
  }

  await prisma.printJobFile.delete({ where: { id: fileId } });

  // Reset print time if this was the last G-code file and time was extracted from G-code
  const currentJob = await prisma.printJob.findUnique({ where: { id }, select: { printTimeFromGcode: true } });
  if (currentJob?.printTimeFromGcode) {
    const remainingGcodeFiles = await prisma.printJobFile.findMany({
      where: { printJobId: id },
      select: { originalName: true },
    });
    const hasGcode = remainingGcodeFiles.some((f) => {
      const ext = f.originalName.split(".").pop()?.toLowerCase();
      return ext === "gcode" || ext === "gco";
    });
    if (!hasGcode) {
      await prisma.printJob.update({
        where: { id },
        data: { printTimeMinutes: null, printTimeFromGcode: false },
      });
    }
  }

  return NextResponse.json({ success: true });
}
