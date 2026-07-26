import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runAutoPlanExclusive } from "@/lib/job-auto-plan";

/**
 * Batches every print-ready part into print jobs. Idempotent — parts already
 * sitting in an active job are ignored, so the jobs board can poll this without
 * creating duplicates. Scheduling onto the timeline is a separate, explicit
 * action (`POST /api/admin/jobs/schedule`).
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const { createdJobIds, skipped } = await runAutoPlanExclusive(userId);
    return NextResponse.json({ createdJobIds, skipped });
  } catch {
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
