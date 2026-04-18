import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isDefault: z.boolean().optional().default(false),
  isPrintReady: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phases = await prisma.partPhase.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { orderParts: true } } },
  });

  return NextResponse.json(phases);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { role?: string };
  if (sessionUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const last = await prisma.partPhase.findFirst({ orderBy: { position: "desc" } });
    const position = (last?.position ?? -1) + 1;

    if (data.isDefault) {
      await prisma.partPhase.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    if (data.isPrintReady) {
      await prisma.partPhase.updateMany({ where: { isPrintReady: true }, data: { isPrintReady: false } });
    }

    const phase = await prisma.partPhase.create({
      data: { ...data, position },
      include: { _count: { select: { orderParts: true } } },
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
