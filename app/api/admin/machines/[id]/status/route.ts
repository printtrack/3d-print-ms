import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertSignedIn } from "@/lib/authz";
import { getProvider, isConnected } from "@/lib/printers";

// Live printer state for the machine, used by the jobs UI badge. Any signed-in
// team member may read it (same audience as the jobs board).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const { id } = await params;
  const machine = await prisma.machine.findUnique({ where: { id } });
  if (!machine) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (!isConnected(machine)) {
    return NextResponse.json({ connected: false, status: null });
  }

  try {
    const status = await getProvider(machine).getPrinterStatus();
    await prisma.machine.update({
      where: { id },
      data: { lastSeenState: status.state, lastSeenAt: new Date() },
    });
    return NextResponse.json({ connected: true, status });
  } catch (err) {
    return NextResponse.json({
      connected: true,
      status: null,
      error: err instanceof Error ? err.message : "Nicht erreichbar",
    });
  }
}
