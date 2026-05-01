import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z
  .object({
    orderId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    name: z.string().min(1),
    dueAt: z.string().datetime().nullable().optional(),
    color: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .refine((d) => !!(d.orderId ?? d.projectId), {
    message: "orderId oder projectId erforderlich",
  });

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const projectId = searchParams.get("projectId");

  const milestones = await prisma.milestone.findMany({
    where: orderId ? { orderId } : projectId ? { projectId } : undefined,
    orderBy: { position: "asc" },
    include: {
      tasks: {
        include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
        orderBy: { position: "asc" },
      },
    },
  });

  return NextResponse.json(milestones);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.dueAt) {
      const dueDate = new Date(data.dueAt);
      if (data.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: data.orderId },
          select: { createdAt: true, deadline: true },
        });
        if (order) {
          if (dueDate < order.createdAt) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht vor dem Erstelldatum liegen" }, { status: 422 });
          }
          if (order.deadline && dueDate > order.deadline) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht nach der Deadline liegen" }, { status: 422 });
          }
        }
      } else if (data.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: data.projectId },
          select: { createdAt: true, deadline: true },
        });
        if (project) {
          if (dueDate < project.createdAt) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht vor dem Erstelldatum liegen" }, { status: 422 });
          }
          if (project.deadline && dueDate > project.deadline) {
            return NextResponse.json({ error: "Fälligkeitsdatum darf nicht nach der Deadline liegen" }, { status: 422 });
          }
        }
      }
    }

    const lastMilestone = await prisma.milestone.findFirst({
      where: data.orderId ? { orderId: data.orderId } : { projectId: data.projectId },
      orderBy: { position: "desc" },
    });

    const milestone = await prisma.milestone.create({
      data: {
        orderId: data.orderId ?? null,
        projectId: data.projectId ?? null,
        name: data.name,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        color: data.color ?? "#6366f1",
        description: data.description ?? null,
        position: (lastMilestone?.position ?? -1) + 1,
      },
      include: {
        tasks: {
          include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Create milestone error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
