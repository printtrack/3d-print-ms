import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { z } from "zod";


const patchSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
});

// PATCH — update triage status (ADMIN only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const { status } = patchSchema.parse(await req.json());
    const updated = await prisma.feedback.update({ where: { id }, data: { status } });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
}

// DELETE — remove a feedback item (ADMIN only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;
  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.feedback.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
