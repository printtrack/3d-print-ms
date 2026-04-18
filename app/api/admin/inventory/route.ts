import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const VALID_MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "PC", "Other"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  material: z.enum(VALID_MATERIALS),
  color: z.string().min(1).max(100),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")).or(z.null()),
  brand: z.string().max(100).optional().or(z.null()),
  spoolWeightGrams: z.number().int().positive(),
  remainingGrams: z.number().int().min(0),
  notes: z.string().optional().or(z.null()),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const material = req.nextUrl.searchParams.get("material");

  const filaments = await prisma.filament.findMany({
    where: material ? { material } : undefined,
    include: { _count: { select: { orderParts: true } } },
    orderBy: [{ material: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(filaments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const filament = await prisma.filament.create({
      data: {
        ...data,
        colorHex: data.colorHex || null,
        brand: data.brand || null,
        notes: data.notes || null,
      },
      include: { _count: { select: { orderParts: true } } },
    });

    return NextResponse.json(filament, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
