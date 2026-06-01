import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  runOrderAutoAdvance,
  runDaysInPhaseAutoAdvanceSweep,
} from "@/lib/phase-auto-advance";

/**
 * Trigger phase auto-advance evaluation. Mirrors the pattern of
 * `/api/admin/invoices/auto-transition`.
 *
 * Body: `{ orderId?: string }`
 *   - If `orderId` is provided, evaluate only that order.
 *   - Otherwise sweep all time-based ("days_in_phase") candidates.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { orderId?: string };

  if (body.orderId) {
    const result = await runOrderAutoAdvance(body.orderId);
    return NextResponse.json(result);
  }
  const result = await runDaysInPhaseAutoAdvanceSweep();
  return NextResponse.json(result);
}
