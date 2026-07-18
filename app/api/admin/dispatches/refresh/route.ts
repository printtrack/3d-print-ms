import { NextResponse } from "next/server";
import { assertSignedIn } from "@/lib/authz";
import { refreshDispatches } from "@/lib/printer-dispatch";

// Bulk-poll in-flight dispatches and advance their state. Mirrors the
// jobs/auto-transition endpoint — called periodically by the jobs board.
export async function POST() {
  const guard = await assertSignedIn();
  if (guard) return guard;

  const result = await refreshDispatches();
  return NextResponse.json(result);
}
