import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertAdmin, assertSignedIn } from "@/lib/authz";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isDefault: z.boolean().optional().default(false),
  isSurvey: z.boolean().optional().default(false),
  isPrototype: z.boolean().optional().default(false),
  isArchive: z.boolean().optional().default(false),
});

export async function GET() {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const phases = await prisma.orderPhase.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { orders: { where: { archivedAt: null } } } } },
  });

  return NextResponse.json(phases);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const lastPhase = await prisma.orderPhase.findFirst({
      orderBy: { position: "desc" },
    });
    const position = (lastPhase?.position ?? -1) + 1;

    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.orderPhase.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // If setting as survey trigger, unset others
    if (data.isSurvey) {
      await prisma.orderPhase.updateMany({
        where: { isSurvey: true },
        data: { isSurvey: false },
      });
    }

    const phase = await prisma.orderPhase.create({
      data: { ...data, position },
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
