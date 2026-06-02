import { prisma } from "@/lib/db";

/**
 * Keeps a milestone's `completedAt` in sync with its tasks: a milestone counts
 * as complete exactly when it has at least one task and all of them are done.
 * Called after any task create/update/delete so the persisted milestone state
 * (used by the project kanban progress bar and the roadmap) stays correct —
 * the client only sets this optimistically.
 */
export async function syncMilestoneCompletion(milestoneId: string): Promise<void> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { completedAt: true, tasks: { select: { completed: true } } },
  });
  if (!milestone) return;

  const allDone =
    milestone.tasks.length > 0 && milestone.tasks.every((t) => t.completed);
  const isCompleted = milestone.completedAt !== null;

  if (allDone !== isCompleted) {
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { completedAt: allDone ? new Date() : null },
    });
  }
}
