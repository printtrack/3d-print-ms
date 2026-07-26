"use client";

import { useTutorial } from "@/lib/tutorial/use-tutorial";
import { TUTORIAL_MACHINES, getTutorialJobs } from "@/lib/tutorial/sample-data";
import { JobsView } from "@/components/admin/JobsView";
import type { PrintJob } from "@/components/admin/JobCard";

interface ServerData {
  machines: typeof TUTORIAL_MACHINES;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialJobs: any[];
  teamMembers?: Array<{ id: string; name: string; email: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSkipped?: any[];
  attendance?: { enabled: boolean; windows: Array<{ day: number; startMinutes: number; endMinutes: number }> };
}

export function TutorialAwareJobsView(props: ServerData) {
  const { state } = useTutorial();

  if (!state.active) {
    return <JobsView {...props} />;
  }

  // The job is already there — planning happens automatically, so the tour shows
  // the result. After print simulated it turns AWAITING_VERIFICATION (orange bar).
  const mockJobs = getTutorialJobs(state.printSimulated) as unknown as PrintJob[];

  return (
    <JobsView
      machines={TUTORIAL_MACHINES}
      initialJobs={mockJobs}
      teamMembers={[]}
      initialSkipped={[]}
      attendance={props.attendance}
    />
  );
}
