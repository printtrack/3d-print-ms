import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, assertSignedIn } from "@/lib/authz";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isDefault: z.boolean().optional().default(false),
  isPrintReady: z.boolean().optional().default(false),
});

export async function GET() {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const phases = await prisma.partPhase.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { orderParts: true } } },
  });

  return NextResponse.json(phases);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

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
