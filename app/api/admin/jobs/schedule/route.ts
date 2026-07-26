import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scheduleUnplannedJobs } from "@/lib/job-schedule";
import { runAutoPlanExclusive } from "@/lib/job-auto-plan";

/**
 * Puts all not-yet-scheduled jobs onto the timeline (deadline first, filament
 * changes minimised). Explicit user action — batching parts into jobs happens
 * automatically, scheduling does not.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    // Pick up parts that became print-ready since the last cycle, then schedule.
    const { skipped } = await runAutoPlanExclusive(userId);
    const { scheduledJobIds, skippedJobIds } = await scheduleUnplannedJobs();
    return NextResponse.json({ scheduledJobIds, skippedJobIds, skipped });
  } catch {
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
