import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";

const patchSchema = z.object({
  reason: z.enum(["MAINTENANCE", "DEFECT"]).optional(),
  note: z.string().max(2000).nullable().optional(),
  startedAt: z.string().datetime().optional(),
  // pass null to reopen, an ISO date to close ("wieder verfügbar")
  endedAt: z.string().datetime().nullable().optional(),
});


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; downtimeId: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id, downtimeId } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const existing = await prisma.machineDowntime.findFirst({
      where: { id: downtimeId, machineId: id },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.startedAt !== undefined) updateData.startedAt = new Date(data.startedAt);
    if (data.endedAt !== undefined) updateData.endedAt = data.endedAt ? new Date(data.endedAt) : null;

    const startedAt = (updateData.startedAt as Date | undefined) ?? existing.startedAt;
    const endedAt =
      data.endedAt !== undefined ? (data.endedAt ? new Date(data.endedAt) : null) : existing.endedAt;
    if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
      return NextResponse.json({ error: "Ende muss nach dem Start liegen" }, { status: 400 });
    }

    const downtime = await prisma.machineDowntime.update({
      where: { id: downtimeId },
      data: updateData,
    });
    return NextResponse.json(downtime);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; downtimeId: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id, downtimeId } = await params;

  const existing = await prisma.machineDowntime.findFirst({
    where: { id: downtimeId, machineId: id },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.machineDowntime.delete({ where: { id: downtimeId } });
  return NextResponse.json({ success: true });
}
