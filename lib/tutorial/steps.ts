import type { TutorialStepId } from "./use-tutorial";

export interface TutorialStep {
  id: TutorialStepId;
  targetSelector: string | null;
  requiredPath: string | null;
  placement: "top" | "bottom" | "left" | "right";
  autoAdvance: boolean;
  showNext: boolean;
  i18nKey: string;
  /** When true, the overlay is visual-only (no click-blocking) so the user
   *  can freely interact with the entire page — used for steps like the 3D viewer. */
  allowFullInteraction?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    targetSelector: null,
    requiredPath: null,
    placement: "bottom",
    autoAdvance: false,
    showNext: false,
    i18nKey: "tutorial.steps.welcome",
  },
  {
    id: "kanban_drag",
    targetSelector: '[data-tutorial="order-card"]',
    requiredPath: "/admin/orders",
    placement: "bottom",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.kanban_drag",
  },
  {
    id: "open_detail",
    targetSelector: '[data-tutorial="order-card"]',
    requiredPath: "/admin/orders",
    placement: "bottom",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.open_detail",
  },
  {
    id: "model_viewer",
    targetSelector: '[data-tutorial="stl-file"]',
    requiredPath: "/admin/orders/tutorial-order-1",
    placement: "bottom",
    autoAdvance: false,
    showNext: true,
    i18nKey: "tutorial.steps.model_viewer",
  },
  {
    id: "viewer_guide",
    // Full interaction: user can freely rotate/zoom the model; coachmark targets controls bar
    targetSelector: '[data-tutorial="viewer-controls"]',
    requiredPath: "/admin/orders/tutorial-order-1",
    placement: "top",
    autoAdvance: false,
    showNext: true,
    allowFullInteraction: true,
    i18nKey: "tutorial.steps.viewer_guide",
  },
  {
    id: "filament_select",
    targetSelector: '[data-tutorial="filament-btn"]',
    requiredPath: "/admin/orders/tutorial-order-1",
    placement: "top",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.filament_select",
  },
  {
    id: "part_phase",
    targetSelector: '[data-tutorial="part-phase-btn"]',
    requiredPath: "/admin/orders/tutorial-order-1",
    placement: "right",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.part_phase",
  },
  {
    id: "jobs_plan",
    targetSelector: '[data-tutorial="plan-jobs-btn"]',
    requiredPath: "/admin/jobs",
    placement: "bottom",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.jobs_plan",
  },
  {
    id: "job_verify",
    targetSelector: '[data-tutorial="awaiting-job"]',
    requiredPath: "/admin/jobs",
    placement: "bottom",
    autoAdvance: true,
    showNext: false,
    i18nKey: "tutorial.steps.job_verify",
  },
  {
    id: "complete",
    targetSelector: null,
    requiredPath: null,
    placement: "bottom",
    autoAdvance: false,
    showNext: false,
    i18nKey: "tutorial.steps.complete",
  },
];

export const STEP_COUNT = TUTORIAL_STEPS.filter(
  (s) => s.id !== "welcome" && s.id !== "complete"
).length;
