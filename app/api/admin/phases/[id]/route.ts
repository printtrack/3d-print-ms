import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  isSurvey: z.boolean().optional(),
  isPrototype: z.boolean().optional(),
});

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    if (data.isDefault) {
      await prisma.orderPhase.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    if (data.isSurvey) {
      await prisma.orderPhase.updateMany({
        where: { isSurvey: true, id: { not: id } },
        data: { isSurvey: false },
      });
    }

    const phase = await prisma.orderPhase.update({
      where: { id },
      data,
    });

    return NextResponse.json(phase);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const activeOrders = await prisma.order.count({ where: { phaseId: id, archivedAt: null } });
  if (activeOrders > 0) {
    return NextResponse.json(
      { error: "Phase kann nicht gelöscht werden – enthält noch Aufträge" },
      { status: 400 }
    );
  }

  // Reassign any archived orders to a fallback phase before deleting
  const fallback =
    (await prisma.orderPhase.findFirst({ where: { id: { not: id }, isDefault: true } })) ??
    (await prisma.orderPhase.findFirst({ where: { id: { not: id } } }));

  if (fallback) {
    await prisma.order.updateMany({ where: { phaseId: id }, data: { phaseId: fallback.id } });
  }

  await prisma.orderPhase.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
