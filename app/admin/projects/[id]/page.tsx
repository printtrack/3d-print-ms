import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectDetail } from "@/components/admin/ProjectDetail";
import type { ProjectDetailData } from "@/components/admin/ProjectDetail";
import type { SprintUI } from "@/components/admin/RoadmapStrip";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { id } = await params;

  // Migrate orphan milestones into a default sprint so the RoadmapStrip can show them
  const orphanCount = await prisma.milestone.count({ where: { projectId: id, sprintId: null } });
  if (orphanCount > 0) {
    const existingSprintCount = await prisma.sprint.count({ where: { projectId: id } });
    if (existingSprintCount === 0) {
      const defaultSprint = await prisma.sprint.create({
        data: { projectId: id, name: "Allgemein", position: 0 },
        select: { id: true },
      });
      await prisma.milestone.updateMany({
        where: { projectId: id, sprintId: null },
        data: { sprintId: defaultSprint.id },
      });
    } else {
      const firstSprint = await prisma.sprint.findFirst({
        where: { projectId: id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (firstSprint) {
        await prisma.milestone.updateMany({
          where: { projectId: id, sprintId: null },
          data: { sprintId: firstSprint.id },
        });
      }
    }
  }

  const [rawProject, rawUsers, rawPhases, rawFilePhases, rawSprints] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        projectPhase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        orders: {
          where: { archivedAt: null },
          include: {
            phase: { select: { id: true, name: true, color: true } },
            assignees: { include: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
        files: {
          include: { phase: { select: { id: true, name: true, color: true } } },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.projectPhase.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.projectFilePhase.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.sprint.findMany({
      where: { projectId: id },
      orderBy: { position: "asc" },
      include: {
        milestones: {
          orderBy: { dueAt: "asc" },
          include: { tasks: { orderBy: { position: "asc" } } },
        },
      },
    }),
  ]);

  if (!rawProject) notFound();

  const sprints: SprintUI[] = rawSprints.map((sp) => ({
    id: sp.id,
    name: sp.name,
    position: sp.position,
    milestones: sp.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      tasks: m.tasks.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
    })),
  }));

  const project: ProjectDetailData = {
    id: rawProject.id,
    name: rawProject.name,
    description: rawProject.description,
    projectPhase: rawProject.projectPhase,
    deadline: rawProject.deadline?.toISOString() ?? null,
    createdAt: rawProject.createdAt.toISOString(),
    updatedAt: rawProject.updatedAt.toISOString(),
    assignees: rawProject.assignees.map((a) => ({ userId: a.userId, user: a.user })),
    orders: rawProject.orders.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      deadline: o.deadline?.toISOString() ?? null,
      projectId: o.projectId,
      phase: o.phase,
      assignees: o.assignees.map((a) => ({ userId: a.userId, user: a.user })),
    })),
    files: rawProject.files.map((f) => ({
      id: f.id,
      filename: f.filename,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      phase: f.phase,
      createdAt: f.createdAt.toISOString(),
    })),
    comments: rawProject.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
    auditLogs: rawProject.auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      user: l.user,
    })),
  };

  return (
    <ProjectDetail
      project={project}
      teamMembers={rawUsers}
      phases={rawPhases}
      filePhases={rawFilePhases}
      sprints={sprints}
    />
  );
}
