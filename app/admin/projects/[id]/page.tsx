import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectDetail } from "@/components/admin/ProjectDetail";
import type { ProjectDetailData } from "@/components/admin/ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { id } = await params;

  const [rawProject, rawUsers, rawPhases] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        projectPhase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        milestones: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
              orderBy: { position: "asc" },
            },
          },
        },
        orders: {
          where: { archivedAt: null },
          include: {
            phase: { select: { id: true, name: true, color: true } },
            assignees: { include: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.projectPhase.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (!rawProject) notFound();

  const project: ProjectDetailData = {
    id: rawProject.id,
    name: rawProject.name,
    description: rawProject.description,
    projectPhase: rawProject.projectPhase,
    deadline: rawProject.deadline?.toISOString() ?? null,
    createdAt: rawProject.createdAt.toISOString(),
    updatedAt: rawProject.updatedAt.toISOString(),
    assignees: rawProject.assignees.map((a) => ({ userId: a.userId, user: a.user })),
    milestones: rawProject.milestones.map((m) => ({
      id: m.id,
      orderId: m.orderId,
      projectId: m.projectId,
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
        assignees: t.assignees,
        position: t.position,
      })),
    })),
    orders: rawProject.orders.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      deadline: o.deadline?.toISOString() ?? null,
      projectId: o.projectId,
      phase: o.phase,
      assignees: o.assignees.map((a) => ({ userId: a.userId, user: a.user })),
    })),
    auditLogs: rawProject.auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      user: l.user,
    })),
  };

  return <ProjectDetail project={project} teamMembers={rawUsers} phases={rawPhases} />;
}
