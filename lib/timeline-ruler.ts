/**
 * Ruler mode selection for horizontal timeline components (JobTimeline, GanttShell).
 * Pass pixels-per-day to get the right rendering tier.
 *
 * "days"        – big day cells, no band overlay needed (zoomed in)
 * "days-band"   – small day cells + month band on top
 * "months-band" – month cells as primary + year band on top (zoomed far out)
 */
export type RulerMode = "days" | "days-band" | "months-band";

export function getRulerMode(pxPerDay: number): RulerMode {
  if (pxPerDay >= 60) return "days";
  if (pxPerDay >= 1.5) return "days-band";
  return "months-band";
}
