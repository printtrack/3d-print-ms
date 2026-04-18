import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ReorderSchema = z.object({
  phaseId: z.string(),
  projectIds: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { phaseId, projectIds } = parsed.data;

  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Validate all projectIds belong to this phase and are not archived
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, projectPhaseId: phaseId, archivedAt: null },
    select: { id: true },
  });

  if (projects.length !== projectIds.length) {
    return NextResponse.json({ error: "Invalid projectIds" }, { status: 400 });
  }

  await prisma.$transaction(
    projectIds.map((id, index) =>
      prisma.project.update({ where: { id }, data: { phaseOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
