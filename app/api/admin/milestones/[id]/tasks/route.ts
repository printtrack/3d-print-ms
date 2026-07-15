import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderOrProjectAccess } from "@/lib/authz";
import { scopeOfMilestone } from "@/lib/authz-resolve";
import { z } from "zod";
import { syncMilestoneCompletion } from "@/lib/milestone-completion";

const createSchema = z.object({
  title: z.string().min(1),
  assigneeIds: z.array(z.string()).default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: milestoneId } = await params;

  const scope = await scopeOfMilestone(milestoneId);
  if (!scope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderOrProjectAccess(scope, { order: "orders.edit", project: "projects.edit" });
  if (guard) return guard;

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

    // A new open task can make a previously completed milestone incomplete again
    await syncMilestoneCompletion(milestoneId);

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
