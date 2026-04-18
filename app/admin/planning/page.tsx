import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PlanningView } from "@/components/admin/PlanningView";
import type { PlanningOrder, PlanningUser } from "@/components/admin/PlanningView";

export default async function PlanningPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const [rawOrders, rawUsers] = await Promise.all([
    prisma.order.findMany({
      where: { archivedAt: null },
      include: {
        phase: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        milestones: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              include: { assignee: { select: { id: true, name: true } } },
              orderBy: { position: "asc" },
            },
          },
        },
        parts: {
          include: {
            printJobParts: {
              include: {
                printJob: {
                  select: {
                    id: true,
                    plannedAt: true,
                    startedAt: true,
                    completedAt: true,
                    printTimeMinutes: true,
                    status: true,
                    machine: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const orders: PlanningOrder[] = rawOrders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    description: o.description,
    isInternal: o.isInternal,
    generalProject: o.generalProject,
    createdAt: o.createdAt.toISOString(),
    deadline: o.deadline?.toISOString() ?? null,
    estimatedCompletionAt: o.estimatedCompletionAt?.toISOString() ?? null,
    priceEstimate: o.priceEstimate ? Number(o.priceEstimate) : null,
    phase: o.phase,
    project: o.project ?? null,
    assignees: o.assignees.map((a) => ({ userId: a.userId, user: a.user })),
    milestones: o.milestones.map((m) => ({
      id: m.id,
      orderId: m.orderId,
      name: m.name,
      description: m.description,
      dueAt: m.dueAt?.toISOString() ?? null,
      completedAt: m.completedAt?.toISOString() ?? null,
      color: m.color,
      position: m.position,
      tasks: m.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        completedAt: t.completedAt?.toISOString() ?? null,
        assigneeId: t.assigneeId,
        assignee: t.assignee,
        position: t.position,
      })),
    })),
    parts: o.parts.map((p) => ({
      printJobParts: p.printJobParts.map((pjp) => ({
        printJob: {
          id: pjp.printJob.id,
          plannedAt: pjp.printJob.plannedAt?.toISOString() ?? null,
          startedAt: pjp.printJob.startedAt?.toISOString() ?? null,
          completedAt: pjp.printJob.completedAt?.toISOString() ?? null,
          printTimeMinutes: pjp.printJob.printTimeMinutes,
          status: pjp.printJob.status,
          machine: pjp.printJob.machine,
        },
      })),
    })),
  }));

  const users: PlanningUser[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return <PlanningView initialOrders={orders} users={users} />;
}
