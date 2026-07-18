import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertJobAccess, getActor } from "@/lib/authz";
import { cancelDispatch, DispatchError } from "@/lib/printer-dispatch";

// Cancel an uploaded/running dispatch.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dispatch = await prisma.printDispatch.findUnique({
    where: { id },
    select: { printJobId: true },
  });
  if (!dispatch) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  const guard = await assertJobAccess(dispatch.printJobId, "jobs.manage");
  if (guard) return guard;

  try {
    const actor = await getActor();
    const updated = await cancelDispatch(id, actor?.id ?? null);
    return NextResponse.json({ dispatch: updated });
  } catch (err) {
    if (err instanceof DispatchError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
