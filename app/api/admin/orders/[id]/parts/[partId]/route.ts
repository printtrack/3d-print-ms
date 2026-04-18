import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filamentId: z.string().nullable().optional(),
  gramsEstimated: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).optional(),
  partPhaseId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partId } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const part = await prisma.orderPart.update({
      where: { id: partId, orderId: id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.filamentId !== undefined ? { filamentId: data.filamentId } : {}),
        ...(data.gramsEstimated !== undefined ? { gramsEstimated: data.gramsEstimated } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.partPhaseId !== undefined ? { partPhaseId: data.partPhaseId } : {}),
      },
      include: {
        filament: { select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true } },
        partPhase: { select: { id: true, name: true, color: true, isPrintReady: true } },
        files: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId: id,
        userId: (session.user as { id?: string })?.id ?? null,
        action: "PART_UPDATED",
        details: `Teil "${part.name}" aktualisiert`,
      },
    });

    return NextResponse.json(part);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, partId } = await params;

  const part = await prisma.orderPart.findUnique({ where: { id: partId, orderId: id } });
  if (!part) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.orderPart.delete({ where: { id: partId } });

  await prisma.auditLog.create({
    data: {
      orderId: id,
      userId: (session.user as { id?: string })?.id ?? null,
      action: "PART_REMOVED",
      details: `Teil "${part.name}" entfernt`,
    },
  });

  return NextResponse.json({ success: true });
}
