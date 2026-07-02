import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertFeature } from "@/lib/features";
import { z } from "zod";

// Date-only ("2026-07-02") or full ISO. Date-only is parsed as *local* midnight
// so it round-trips to the same calendar day when read back with local getters.
const dateSchema = z.string().refine((s) => !Number.isNaN(parseDateInput(s).getTime()), "Ungültiges Datum");

function parseDateInput(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
}

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).nullish(),
    startAt: dateSchema,
    endAt: dateSchema.optional(),
    allDay: z.boolean().optional(),
    color: z.string().max(32).optional(),
    ownerId: z.string().nullish(),
  })
  .transform((v) => ({ ...v, endAt: v.endAt ?? v.startAt }));

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const events = await prisma.calendarEvent.findMany({
    orderBy: { startAt: "asc" },
    include: { owner: { select: { id: true, name: true } } },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  try {
    const data = createSchema.parse(await req.json());
    const start = parseDateInput(data.startAt);
    const end = parseDateInput(data.endAt);
    const event = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        note: data.note ?? null,
        startAt: start,
        endAt: end < start ? start : end,
        allDay: data.allDay ?? true,
        color: data.color ?? "#64748b",
        ownerId: data.ownerId || null,
        createdById: (session.user as { id?: string } | undefined)?.id ?? null,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
