"use client";

import { createContext, useContext, useReducer, useCallback } from "react";
import { TUTORIAL_PHASES, TUTORIAL_ORDER_KANBAN } from "./sample-data";

export type TutorialStepId =
  | "welcome"
  | "kanban_drag"
  | "open_detail"
  | "model_viewer"
  | "viewer_guide"
  | "filament_select"
  | "part_phase"
  | "jobs_plan"
  | "job_verify"
  | "complete";

export interface TutorialState {
  active: boolean;
  step: TutorialStepId;
  // track which tutorial-phase the mock order is currently in
  mockOrderPhaseId: string;
  // whether we have simulated "print done" for the verify step
  printSimulated: boolean;
}

type TutorialAction =
  | { type: "START" }
  | { type: "SKIP" }
  | { type: "ADVANCE" }
  | { type: "BACK" }
  | { type: "SET_STEP"; step: TutorialStepId }
  | { type: "MOVE_ORDER"; phaseId: string }
  | { type: "SIMULATE_PRINT_DONE" }
  | { type: "COMPLETE" }
  | { type: "RESET" };

const STEP_ORDER: TutorialStepId[] = [
  "welcome",
  "kanban_drag",
  "open_detail",
  "model_viewer",
  "viewer_guide",
  "filament_select",
  "part_phase",
  "jobs_plan",
  "job_verify",
  "complete",
];

const INITIAL_STATE: TutorialState = {
  active: false,
  step: "welcome",
  mockOrderPhaseId: TUTORIAL_PHASES[0].id,
  printSimulated: false,
};

function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case "START":
      return { ...state, active: true, step: "welcome", mockOrderPhaseId: TUTORIAL_PHASES[0].id, printSimulated: false };
    case "SKIP":
    case "COMPLETE":
      return { ...state, active: false, step: "welcome" };
    case "ADVANCE": {
      const idx = STEP_ORDER.indexOf(state.step);
      const next = STEP_ORDER[idx + 1] ?? "complete";
      return { ...state, step: next };
    }
    case "BACK": {
      const idx = STEP_ORDER.indexOf(state.step);
      const prev = STEP_ORDER[Math.max(0, idx - 1)];
      return { ...state, step: prev };
    }
    case "SET_STEP":
      return { ...state, step: action.step };
    case "MOVE_ORDER":
      return { ...state, mockOrderPhaseId: action.phaseId };
    case "SIMULATE_PRINT_DONE":
      return { ...state, printSimulated: true };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export interface TutorialContextValue {
  state: TutorialState;
  start: () => void;
  skip: () => void;
  advance: () => void;
  back: () => void;
  setStep: (step: TutorialStepId) => void;
  complete: () => void;
  moveOrder: (phaseId: string) => void;
  simulatePrintDone: () => void;
  currentMockOrder: typeof TUTORIAL_ORDER_KANBAN;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be inside TutorialProvider");
  return ctx;
}

export function useTutorialReducer() {
  const [state, dispatch] = useReducer(tutorialReducer, INITIAL_STATE);

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const skip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const advance = useCallback(() => dispatch({ type: "ADVANCE" }), []);
  const back = useCallback(() => dispatch({ type: "BACK" }), []);
  const setStep = useCallback((step: TutorialStepId) => dispatch({ type: "SET_STEP", step }), []);
  const complete = useCallback(() => dispatch({ type: "COMPLETE" }), []);
  const moveOrder = useCallback((phaseId: string) => dispatch({ type: "MOVE_ORDER", phaseId }), []);
  const simulatePrintDone = useCallback(() => dispatch({ type: "SIMULATE_PRINT_DONE" }), []);

  const currentMockOrder = {
    ...TUTORIAL_ORDER_KANBAN,
    phaseId: state.mockOrderPhaseId,
    phase: TUTORIAL_PHASES.find((p) => p.id === state.mockOrderPhaseId) ?? TUTORIAL_PHASES[0],
  };

  return { state, start, skip, advance, back, setStep, complete, moveOrder, simulatePrintDone, currentMockOrder };
}
