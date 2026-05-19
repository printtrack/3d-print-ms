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
}

export function TutorialAwareJobsView(props: ServerData) {
  const { state } = useTutorial();

  if (!state.active) {
    return <JobsView {...props} />;
  }

  // Before planning: no jobs — the user is about to create them
  // After print simulated: AWAITING_VERIFICATION so the job bar appears orange
  const mockJobs = state.printSimulated
    ? (getTutorialJobs(true) as unknown as PrintJob[])
    : ([] as PrintJob[]);

  return (
    <JobsView
      machines={TUTORIAL_MACHINES}
      initialJobs={mockJobs}
      teamMembers={[]}
    />
  );
}
