import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderOrProjectAccess, assertSignedIn } from "@/lib/authz";
import { z } from "zod";

const createSchema = z
  .object({
    orderId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    name: z.string().min(1),
  })
  .refine((d) => !!(d.orderId ?? d.projectId), {
    message: "orderId oder projectId erforderlich",
  });

export async function GET(req: NextRequest) {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const projectId = searchParams.get("projectId");

  const sprints = await prisma.sprint.findMany({
    where: orderId ? { orderId } : projectId ? { projectId } : undefined,
    orderBy: { position: "asc" },
    include: {
      milestones: {
        orderBy: { dueAt: "asc" },
        include: {
          tasks: {
            include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json(sprints);
}

export async function POST(req: NextRequest) {


  try {
    const body = await req.json();
    const data = createSchema.parse(body);

  const guard = await assertOrderOrProjectAccess(
    { orderId: data.orderId ?? null, projectId: data.projectId ?? null },
    { order: "orders.edit", project: "projects.edit" },
  );
  if (guard) return guard;

    const last = await prisma.sprint.findFirst({
      where: data.orderId ? { orderId: data.orderId } : { projectId: data.projectId },
      orderBy: { position: "desc" },
    });

    const sprint = await prisma.sprint.create({
      data: {
        orderId: data.orderId ?? null,
        projectId: data.projectId ?? null,
        name: data.name,
        position: (last?.position ?? -1) + 1,
      },
      include: {
        milestones: {
          orderBy: { dueAt: "asc" },
          include: {
            tasks: {
              include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Create sprint error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
