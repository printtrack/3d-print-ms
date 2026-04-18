// ── Gantt layout constants ────────────────────────────────────────────────────
export const LABEL_COL_W = 240;
export const ROW_H = 56;
export const LANE_ROW_H = 44;
export const SUB_ROW_H = 36;
export const RULER_H = 72;
export const OPEN_BAR_DAYS = 30;
export const MIN_PX_D = 4;
export const MAX_PX_D = 200;

export type ViewMode = "week" | "month" | "quarter";

export const DEFAULT_PX_D: Record<ViewMode, number> = {
  week: 80,
  month: 30,
  quarter: 12,
};

// ── Date / label names ────────────────────────────────────────────────────────
export const DAY_NAMES_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const MONTH_NAMES = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];
export const MONTH_NAMES_LONG = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
export const DAY_NAMES_LONG = [
  "Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag",
];

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isToday(d: Date): boolean {
  return isSameLocalDay(d, new Date());
}

// ── Gantt positioning helpers ─────────────────────────────────────────────────

export function barLeft(dateStr: string, viewStart: Date, pxD: number): number {
  const d = new Date(dateStr);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return ((local.getTime() - viewStart.getTime()) / 86_400_000) * pxD;
}

export function barWidth(start: string, end: string | null, pxD: number): number {
  if (!end) return OPEN_BAR_DAYS * pxD;
  return Math.max(pxD * 0.5, ((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) * pxD);
}

export function getViewStart(viewMode: ViewMode, viewDate: Date): Date {
  if (viewMode === "week") return getMondayOfWeek(viewDate);
  if (viewMode === "month") return new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const q = Math.floor(viewDate.getMonth() / 3);
  return new Date(viewDate.getFullYear(), q * 3, 1);
}

export function getViewDays(viewMode: ViewMode, viewDate: Date): number {
  if (viewMode === "week") return 7;
  if (viewMode === "month") {
    return new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  }
  const q = Math.floor(viewDate.getMonth() / 3);
  let days = 0;
  for (let m = q * 3; m < q * 3 + 3; m++) {
    days += new Date(viewDate.getFullYear(), m + 1, 0).getDate();
  }
  return days;
}

export function getNavLabel(viewMode: ViewMode, viewDate: Date): string {
  const weekStart = getMondayOfWeek(viewDate);
  const weekEnd = getWeekDays(weekStart)[6];
  if (viewMode === "week") {
    return weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()}. – ${weekEnd.getDate()}. ${MONTH_NAMES_LONG[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : `${weekStart.getDate()}. ${MONTH_NAMES[weekStart.getMonth()]} – ${weekEnd.getDate()}. ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  }
  if (viewMode === "month") {
    return `${MONTH_NAMES_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  }
  const q = Math.floor(viewDate.getMonth() / 3) + 1;
  return `Q${q} ${viewDate.getFullYear()}`;
}

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

/** Assign each item to a lane to prevent horizontal overlap */
export function assignLanes<T extends { id: string; createdAt: string; deadline: string | null }>(
  items: T[],
  viewStart: Date,
  pxD: number
): Map<string, number> {
  const lanes = new Map<string, number>();
  const laneEnds: number[] = [];

  const sorted = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const item of sorted) {
    const left = barLeft(item.createdAt, viewStart, pxD);
    const right = item.deadline
      ? left + barWidth(item.createdAt, item.deadline, pxD)
      : left + OPEN_BAR_DAYS * pxD;

    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] > left + 2) lane++;
    lanes.set(item.id, lane);
    laneEnds[lane] = right;
  }

  return lanes;
}
