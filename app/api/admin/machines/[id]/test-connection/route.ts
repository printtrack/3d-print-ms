import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import { getProvider, isConnected } from "@/lib/printers";

// One-shot connectivity check: read the printer status and cache it. ADMIN only.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;
  const machine = await prisma.machine.findUnique({ where: { id } });
  if (!machine) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (!isConnected(machine)) {
    return NextResponse.json(
      { error: "Keine Verbindung konfiguriert" },
      { status: 409 }
    );
  }

  try {
    const status = await getProvider(machine).getPrinterStatus();
    await prisma.machine.update({
      where: { id },
      data: { lastSeenState: status.state, lastSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" },
      { status: 502 }
    );
  }
}
