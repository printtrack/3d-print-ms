import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  assigneeIds: z.array(z.string()).default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: milestoneId } = await params;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const last = await prisma.milestoneTask.findFirst({
      where: { milestoneId },
      orderBy: { position: "desc" },
    });

    const task = await prisma.milestoneTask.create({
      data: {
        milestoneId,
        title: data.title,
        position: (last?.position ?? -1) + 1,
        ...(data.assigneeIds.length > 0
          ? { assignees: { create: data.assigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
