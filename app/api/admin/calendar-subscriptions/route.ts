import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { assertFeature } from "@/lib/features";
import { testSubscriptionUrl } from "@/lib/web-calendar";
import { z } from "zod";


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
  const authGuard = await assertAdmin();
  if (authGuard) return authGuard;
  const featureGuard = await assertFeature("planning");
  if (featureGuard) return featureGuard;

  const subs = await prisma.calendarSubscription.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const authGuard = await assertAdmin();
  if (authGuard) return authGuard;
  const featureGuard = await assertFeature("planning");
  if (featureGuard) return featureGuard;

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
