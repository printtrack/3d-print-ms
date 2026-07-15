import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertProjectAccess, getActor } from "@/lib/authz";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const guard = await assertProjectAccess(projectId, "projects.edit");
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }

    const comment = await prisma.projectComment.create({
      data: {
        projectId,
        authorId: (await getActor())!.id,
        content: data.content,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    await prisma.projectAuditLog.create({
      data: {
        projectId,
        userId: (await getActor())!.id,
        action: "COMMENT_ADDED",
        details: data.content.length > 80 ? data.content.slice(0, 80) + "…" : data.content,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Create project comment error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
