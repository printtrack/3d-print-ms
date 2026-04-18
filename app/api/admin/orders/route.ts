import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createInternalProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  deadline: z.string().datetime().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  isInternal: z.literal(true),
  generalProject: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const phaseId = searchParams.get("phaseId");
  const search = searchParams.get("search");
  const showArchived = searchParams.get("showArchived") === "true";
  const overdue = searchParams.get("overdue") === "true";
  const dueToday = searchParams.get("dueToday") === "true";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: {
      archivedAt: showArchived ? { not: null } : null,
      ...(phaseId ? { phaseId } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search } },
              { customerEmail: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
      ...(overdue ? { deadline: { lt: now }, archivedAt: null } : {}),
      ...(dueToday ? { deadline: { gte: startOfToday, lte: endOfToday }, archivedAt: null } : {}),
    },
    include: {
      phase: { select: { id: true, name: true, color: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      files: { select: { id: true, originalName: true, mimeType: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
      ...(search
        ? {
            parts: {
              select: {
                id: true,
                name: true,
                filamentId: true,
                gramsEstimated: true,
                filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
              },
            },
          }
        : {}),
    },
    orderBy: [
      { phaseOrder: { sort: "asc", nulls: "last" } },
      { deadline: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createInternalProjectSchema.parse(body);

    const defaultPhase = await prisma.orderPhase.findFirst({ where: { isDefault: true } });
    if (!defaultPhase) {
      return NextResponse.json({ error: "Keine Standardphase gefunden" }, { status: 500 });
    }

    const order = await prisma.order.create({
      data: {
        customerName: data.name,
        customerEmail: "intern@intern",
        description: data.description,
        phaseId: defaultPhase.id,
        isInternal: true,
        generalProject: data.generalProject ?? false,
        deadline: data.deadline ? new Date(data.deadline) : null,
        assignees: data.assigneeIds?.length
          ? { create: data.assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        phase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        milestones: { orderBy: { position: "asc" }, include: { tasks: { include: { assignee: { select: { id: true, name: true } } } } } },
        parts: { include: { printJobParts: { include: { printJob: { select: { id: true, plannedAt: true, startedAt: true, completedAt: true, printTimeMinutes: true, status: true, machine: { select: { id: true, name: true } } } } } } } },
      },
    });

    // Write audit log — non-critical, skip silently if userId is stale
    try {
      await prisma.auditLog.create({
        data: {
          orderId: order.id,
          userId: session.user?.id ?? null,
          action: "ORDER_CREATED",
          details: `Internes Projekt "${data.name}" erstellt`,
        },
      });
    } catch {
      // Ignore FK violation if session user no longer exists in DB
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.constructor.name === "ZodError") {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Create internal project error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
