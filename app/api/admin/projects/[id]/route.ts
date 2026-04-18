import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  projectPhaseId: z.string().optional(),
  deadline: z.string().datetime().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  archive: z.boolean().optional(),
});

const projectInclude = {
  projectPhase: { select: { id: true, name: true, color: true } },
  assignees: { include: { user: { select: { id: true, name: true } } } },
  milestones: {
    orderBy: { position: "asc" } as const,
    include: {
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { position: "asc" } as const,
      },
    },
  },
  orders: {
    where: { archivedAt: null } as const,
    include: {
      phase: { select: { id: true, name: true, color: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" } as const,
  },
  auditLogs: {
    orderBy: { createdAt: "desc" } as const,
    take: 50,
    include: { user: { select: { id: true, name: true } } },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: projectInclude,
  });

  if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    // Fetch current state for audit log
    const current = await prisma.project.findUnique({
      where: { id },
      select: { projectPhaseId: true, name: true, projectPhase: { select: { name: true } } },
    });
    if (!current) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const auditEntries: { userId: string | null; action: string; details?: string }[] = [];

    if (data.projectPhaseId && data.projectPhaseId !== current.projectPhaseId) {
      const newPhase = await prisma.projectPhase.findUnique({
        where: { id: data.projectPhaseId },
        select: { name: true },
      });
      auditEntries.push({
        userId: session.user?.id ?? null,
        action: "PHASE_CHANGED",
        details: `${current.projectPhase.name} → ${newPhase?.name ?? data.projectPhaseId}`,
      });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.projectPhaseId !== undefined ? { projectPhaseId: data.projectPhaseId } : {}),
        ...(data.deadline !== undefined
          ? { deadline: data.deadline ? new Date(data.deadline) : null }
          : {}),
        ...(data.archive === true ? { archivedAt: new Date() } : {}),
        ...(data.assigneeIds !== undefined
          ? {
              assignees: {
                deleteMany: {},
                create: data.assigneeIds.map((userId) => ({ userId })),
              },
            }
          : {}),
        ...(auditEntries.length > 0
          ? { auditLogs: { create: auditEntries } }
          : {}),
      },
      include: projectInclude,
    });

    return NextResponse.json(project);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Update project error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
