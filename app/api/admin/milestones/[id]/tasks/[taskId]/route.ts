import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { syncMilestoneCompletion } from "@/lib/milestone-completion";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: milestoneId, taskId } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    if (data.assigneeIds !== undefined) {
      await prisma.milestoneTaskAssignee.deleteMany({ where: { taskId } });
      if (data.assigneeIds.length > 0) {
        await prisma.milestoneTaskAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ taskId, userId })),
        });
      }
    }

    const task = await prisma.milestoneTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.completed !== undefined
          ? {
              completed: data.completed,
              completedAt: data.completed ? new Date() : null,
            }
          : {}),
      },
      include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
    });

    // Keep the parent milestone's completedAt in sync with its tasks
    if (data.completed !== undefined) {
      await syncMilestoneCompletion(milestoneId);
    }

    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: milestoneId, taskId } = await params;

  await prisma.milestoneTask.delete({ where: { id: taskId } });

  // Deleting the last open task may complete the milestone (and vice versa)
  await syncMilestoneCompletion(milestoneId);

  return NextResponse.json({ success: true });
}
