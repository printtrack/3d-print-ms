import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertFeature } from "@/lib/features";
import { testSubscriptionUrl } from "@/lib/web-calendar";
import { z } from "zod";
import type { Session } from "next-auth";

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const urlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((u) => /^(https?:\/\/|webcal:\/\/)/i.test(u), "URL muss mit http(s):// oder webcal:// beginnen");

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: urlSchema,
  color: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const subs = await prisma.calendarSubscription.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  try {
    const data = createSchema.parse(await req.json());

    // Verify the feed is reachable + parseable before persisting.
    try {
      await testSubscriptionUrl(data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Kalender nicht erreichbar: ${message}` }, { status: 400 });
    }

    const sub = await prisma.calendarSubscription.create({
      data: {
        name: data.name,
        url: data.url,
        color: data.color ?? "#0ea5e9",
        isActive: data.isActive ?? true,
        lastFetchedAt: new Date(),
      },
    });
    return NextResponse.json(sub, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
