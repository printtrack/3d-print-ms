import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertJobAccess, getActor } from "@/lib/authz";
import { createDispatch, DispatchError } from "@/lib/printer-dispatch";
import { z } from "zod";

const bodySchema = z.object({
  fileId: z.string().min(1).optional(),
  autoStart: z.boolean().optional(),
});

// List the dispatches of a job (newest first).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await assertJobAccess(id, "jobs.manage");
  if (guard) return guard;

  const dispatches = await prisma.printDispatch.findMany({
    where: { printJobId: id },
    orderBy: { createdAt: "desc" },
    include: {
      machine: { select: { id: true, name: true, connectionType: true } },
      printJobFile: { select: { id: true, originalName: true } },
    },
  });
  return NextResponse.json(dispatches);
}

// Send a job's file to its machine's printer (auto-start when the printer is idle).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await assertJobAccess(id, "jobs.manage");
  if (guard) return guard;

  try {
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const actor = await getActor();
    const { dispatch, httpStatus } = await createDispatch({
      jobId: id,
      fileId: body.fileId,
      autoStart: body.autoStart ?? true,
      actorId: actor?.id ?? null,
    });
    return NextResponse.json({ dispatch }, { status: httpStatus });
  } catch (err) {
    if (err instanceof DispatchError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
