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

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: urlSchema.optional(),
  color: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());

    if (body.url !== undefined) {
      try {
        await testSubscriptionUrl(body.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Kalender nicht erreichbar: ${message}` }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.url !== undefined) {
      data.url = body.url;
      data.lastError = null;
      data.lastFetchedAt = new Date();
    }
    if (body.color !== undefined) data.color = body.color;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const sub = await prisma.calendarSubscription.update({ where: { id }, data });
    return NextResponse.json(sub);
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
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const guard = await assertFeature("planning");
  if (guard) return guard;

  const { id } = await params;
  await prisma.calendarSubscription.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
