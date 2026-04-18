import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isDefault: z.boolean().optional().default(false),
  isSurvey: z.boolean().optional().default(false),
  isPrototype: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phases = await prisma.orderPhase.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { orders: { where: { archivedAt: null } } } } },
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
