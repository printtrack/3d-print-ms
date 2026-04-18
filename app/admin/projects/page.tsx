import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectsView } from "@/components/admin/ProjectsView";
import type { ProjectKanbanItem, ProjectPhaseData } from "@/components/admin/ProjectKanbanBoard";
import type { GanttProject } from "@/components/admin/ProjectGantt";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as { role?: string })?.role;

  const [rawPhases, rawProjects, rawUsers] = await Promise.all([
    prisma.projectPhase.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
    }),
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: [{ projectPhaseId: "asc" }, { phaseOrder: "asc" }],
      include: {
        projectPhase: { select: { id: true, name: true, color: true } },
        _count: { select: { orders: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        milestones: {
          orderBy: { position: "asc" },
          select: { id: true, name: true, dueAt: true, completedAt: true, color: true, position: true },
        },
        orders: {
          where: { archivedAt: null },
          include: {
            phase: { select: { id: true, name: true, color: true } },
            assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
            milestones: {
              orderBy: { position: "asc" },
              select: { id: true, name: true, dueAt: true, completedAt: true, color: true, position: true },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const phases: ProjectPhaseData[] = rawPhases.map((ph) => ({
    id: ph.id,
    name: ph.name,
    color: ph.color,
    position: ph.position,
    isDefault: ph.isDefault,
    _count: { projects: ph._count.projects },
  }));

  const projects: ProjectKanbanItem[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    projectPhaseId: p.projectPhaseId,
    projectPhase: p.projectPhase,
    phaseOrder: p.phaseOrder,
    deadline: p.deadline?.toISOString() ?? null,
    milestoneTotal: p.milestones.length,
    milestoneCompleted: p.milestones.filter((m) => m.completedAt !== null).length,
    orderCount: p._count.orders,
    assignees: p.assignees.map((a) => ({ userId: a.userId, user: a.user })),
  }));

  const ganttProjects: GanttProject[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    deadline: p.deadline?.toISOString() ?? null,
    projectPhase: p.projectPhase,
    milestones: p.milestones.map((m) => ({
      ...m,
      dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    })),
    orders: p.orders.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      createdAt: o.createdAt.toISOString(),
      deadline: o.deadline?.toISOString() ?? null,
      phase: o.phase,
      assignees: o.assignees.map((a) => a.user),
      milestones: o.milestones.map((m) => ({
        ...m,
        dueAt: m.dueAt ? m.dueAt.toISOString() : null,
        completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      })),
    })),
  }));

  return (
    <ProjectsView
      phases={phases}
      projects={projects}
      ganttProjects={ganttProjects}
      isAdmin={userRole === "ADMIN"}
      users={rawUsers}
    />
  );
}
