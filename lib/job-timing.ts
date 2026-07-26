/**
 * Timing constants shared by planner, scheduler and timeline. Kept free of
 * Prisma imports so client components can use them too.
 */

/** Assumed duration of a job without a measured print time. */
export const DEFAULT_PRINT_MINUTES = 120;

/** Time reserved on the machine when the operator has to swap spools. */
export const FILAMENT_CHANGE_MINUTES = 15;

/**
 * Head start before the first auto-scheduled job. Jobs auto-transition to
 * IN_PROGRESS once `plannedAt` has passed, so scheduling at "now" would flip a
 * fresh job into printing before anyone loaded the plate.
 */
export const PLANNING_LEAD_MINUTES = 30;
