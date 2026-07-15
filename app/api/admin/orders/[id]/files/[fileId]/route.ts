import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { unlink } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { z } from "zod";

const patchSchema = z.object({
  category: z.enum(["REFERENCE", "DESIGN", "RESULT", "OTHER"]).optional(),
  orderPartId: z.string().nullable().optional(),
}).refine((d) => d.category !== undefined || d.orderPartId !== undefined, {
  message: "At least one field required",
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: orderId, fileId } = await params;

  const guard = await assertOrderAccess(orderId, "orders.edit");
  if (guard) return guard;

  try {
    const body = await req.json();
    const { category, orderPartId } = patchSchema.parse(body);

    const file = await prisma.orderFile.findFirst({
      where: { id: fileId, orderId },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.orderFile.update({
      where: { id: fileId },
      data: {
        ...(category !== undefined && { category }),
        ...(orderPartId !== undefined && { orderPartId }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("File patch error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: orderId, fileId } = await params;

  const guard = await assertOrderAccess(orderId, "orders.edit");
  if (guard) return guard;

  const file = await prisma.orderFile.findFirst({
    where: { id: fileId, orderId },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.orderFile.delete({ where: { id: fileId } });

  const filePath = path.join(getUploadDir(), orderId, file.filename);
  try {
    await unlink(filePath);
  } catch {
    console.warn(`Could not delete file: ${filePath}`);
  }

  await prisma.auditLog.create({
    data: {
      orderId,
      userId: (await getActor())?.id ?? null,
      action: "FILE_DELETED",
      details: `Datei gelöscht: ${file.originalName}`,
    },
  });

  return NextResponse.json({ success: true });
}
