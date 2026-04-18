import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  projectPhaseId: z.string().optional(),
  deadline: z.string().datetime().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phaseFilter = searchParams.get("phaseId");
  const search = searchParams.get("search");

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(phaseFilter ? { projectPhaseId: phaseFilter } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: [{ projectPhaseId: "asc" }, { phaseOrder: "asc" }],
    include: {
      projectPhase: { select: { id: true, name: true, color: true } },
      _count: { select: { orders: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      milestones: { select: { id: true, completedAt: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Resolve project phase
    let projectPhaseId = data.projectPhaseId;
    if (!projectPhaseId) {
      const defaultPhase = await prisma.projectPhase.findFirst({ where: { isDefault: true } });
      projectPhaseId = defaultPhase?.id;
    }
    if (!projectPhaseId) {
      return NextResponse.json({ error: "Keine Projektphase gefunden" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        projectPhaseId,
        deadline: data.deadline ? new Date(data.deadline) : null,
        assignees: data.assigneeIds?.length
          ? { create: data.assigneeIds.map((userId) => ({ userId })) }
          : undefined,
        auditLogs: {
          create: {
            userId: session.user?.id ?? null,
            action: "PROJECT_CREATED",
            details: data.name,
          },
        },
      },
      include: {
        projectPhase: { select: { id: true, name: true, color: true } },
        _count: { select: { orders: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        milestones: { select: { id: true, completedAt: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Create project error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
