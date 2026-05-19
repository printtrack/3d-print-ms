"use client";

import { useTutorial } from "@/lib/tutorial/use-tutorial";
import { TUTORIAL_PHASES } from "@/lib/tutorial/sample-data";
import { DashboardView } from "@/components/admin/DashboardView";

interface ServerData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phases: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders: any[];
  archiveCount: number;
  showArchived: boolean;
  isAdmin: boolean;
  searchQuery?: string;
  filterKey: string;
  users: { id: string; name: string; email: string }[];
}

export function TutorialAwareOrdersView(props: ServerData) {
  const { state, currentMockOrder } = useTutorial();

  if (!state.active) {
    return <DashboardView {...props} />;
  }

  // In tutorial mode: override with a single mock order and tutorial phases
  const mockOrder = {
    ...currentMockOrder,
    // Keep phase in sync with tutorial state
    phase: TUTORIAL_PHASES.find((p) => p.id === state.mockOrderPhaseId) ?? TUTORIAL_PHASES[0],
    phaseId: state.mockOrderPhaseId,
    // attach data-tutorial attribute via a wrapper element trick: we add a wrapper div
    // around the card. The actual data-tutorial attr is added to OrderCard via KanbanBoard
    // when it renders order id === TUTORIAL_ORDER_ID (handled in KanbanBoard with data-tutorial).
  };

  return (
    <DashboardView
      {...props}
      phases={TUTORIAL_PHASES}
      orders={[mockOrder]}
      archiveCount={0}
      showArchived={false}
      filterKey="tutorial"
    />
  );
}
