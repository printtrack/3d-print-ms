import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  problem: z.string().min(1),
  solution: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  const entries = await prisma.knowledgeEntry.findMany({
    where: search
      ? {
          OR: [
            { title: { contains: search } },
            { problem: { contains: search } },
            { solution: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, name: true } }, files: true },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const entry = await prisma.knowledgeEntry.create({
      data: {
        ...data,
        authorId: (session.user as { id?: string }).id ?? null,
      },
      include: { author: { select: { id: true, name: true } }, files: true },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
