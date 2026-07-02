import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertFeature } from "@/lib/features";
import { z } from "zod";

function parseDateInput(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
}
const dateSchema = z.string().refine((s) => !Number.isNaN(parseDateInput(s).getTime()), "Ungültiges Datum");

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).nullish(),
  startAt: dateSchema.optional(),
  endAt: dateSchema.optional(),
  allDay: z.boolean().optional(),
  color: z.string().max(32).optional(),
  ownerId: z.string().nullish(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.note !== undefined) data.note = body.note ?? null;
    if (body.startAt !== undefined) data.startAt = parseDateInput(body.startAt);
    if (body.endAt !== undefined) data.endAt = parseDateInput(body.endAt);
    if (body.allDay !== undefined) data.allDay = body.allDay;
    if (body.color !== undefined) data.color = body.color;
    if (body.ownerId !== undefined) data.ownerId = body.ownerId || null;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data,
      include: { owner: { select: { id: true, name: true } } },
    });
    return NextResponse.json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
