/**
 * Attendance = when somebody is on site. Printers run unattended, but every
 * human step around a print — loading the plate, swapping filament, taking the
 * finished part off — can only happen inside these windows. The scheduler uses
 * them so a print may run through the weekend while its pickup waits for Monday.
 */
export interface AttendanceWindow {
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
  day: number;
  /** Minutes since midnight, local time. */
  startMinutes: number;
  endMinutes: number;
}

export const ATTENDANCE_ENABLED_KEY = "attendance_enabled";
export const ATTENDANCE_WINDOWS_KEY = "attendance_windows";

/** Mon–Fri 08:00–18:00 — the assumption until someone configures otherwise. */
export const DEFAULT_ATTENDANCE_WINDOWS: AttendanceWindow[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  startMinutes: 8 * 60,
  endMinutes: 18 * 60,
}));

export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseWindows(raw: string | null | undefined): AttendanceWindow[] {
  if (!raw) return DEFAULT_ATTENDANCE_WINDOWS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ATTENDANCE_WINDOWS;
    return parsed
      .filter(
        (w): w is AttendanceWindow =>
          typeof w?.day === "number" &&
          typeof w?.startMinutes === "number" &&
          typeof w?.endMinutes === "number" &&
          w.endMinutes > w.startMinutes
      )
      .map((w) => ({ day: w.day % 7, startMinutes: w.startMinutes, endMinutes: w.endMinutes }));
  } catch {
    return DEFAULT_ATTENDANCE_WINDOWS;
  }
}

export interface AttendanceConfig {
  enabled: boolean;
  windows: AttendanceWindow[];
}

/** Pure — the DB read lives in `lib/attendance-server.ts` so client code can
 *  import the maths without pulling Prisma into the bundle. */
export function attendanceFromSettings(settings: Record<string, string>): AttendanceConfig {
  return {
    // Opt-in: without the setting the planner behaves as before (24/7 staffing).
    enabled: settings[ATTENDANCE_ENABLED_KEY] === "true",
    windows: parseWindows(settings[ATTENDANCE_WINDOWS_KEY]),
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Concrete [start, end) attendance intervals covering `from` … `to`. */
export function attendanceIntervals(
  config: AttendanceConfig,
  from: Date,
  to: Date
): Array<{ start: number; end: number }> {
  if (!config.enabled || config.windows.length === 0) {
    return [{ start: from.getTime(), end: to.getTime() }];
  }

  const out: Array<{ start: number; end: number }> = [];
  const cursor = startOfDay(from);
  // One day of slack on each side so windows overlapping the range are included.
  cursor.setDate(cursor.getDate() - 1);
  const limit = to.getTime() + 86_400_000;

  while (cursor.getTime() <= limit) {
    for (const w of config.windows) {
      if (w.day !== cursor.getDay()) continue;
      const start = new Date(cursor);
      start.setMinutes(w.startMinutes);
      const end = new Date(cursor);
      end.setMinutes(w.endMinutes);
      out.push({ start: start.getTime(), end: end.getTime() });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Is somebody on site at `at`? */
export function isAttended(config: AttendanceConfig, at: Date | number): boolean {
  if (!config.enabled || config.windows.length === 0) return true;
  const ms = typeof at === "number" ? at : at.getTime();
  const d = new Date(ms);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return config.windows.some((w) => w.day === d.getDay() && minutes >= w.startMinutes && minutes < w.endMinutes);
}

/**
 * Earliest moment from `fromMs` at which an attended task of `durationMs` fits
 * completely into one window. Returns `null` when no window is long enough
 * within the search horizon.
 */
export function nextAttendedSlot(
  config: AttendanceConfig,
  fromMs: number,
  durationMs = 0,
  horizonDays = 60
): number | null {
  if (!config.enabled || config.windows.length === 0) return fromMs;

  const from = new Date(fromMs);
  const to = new Date(fromMs + horizonDays * 86_400_000);
  for (const iv of attendanceIntervals(config, from, to)) {
    const start = Math.max(iv.start, fromMs);
    // `start < iv.end` keeps this consistent with isAttended(): the closing
    // minute is no longer staffed, so a print finishing exactly at 18:00 waits
    // for the next window rather than counting as "somebody was there".
    if (start < iv.end && start + durationMs <= iv.end) return start;
  }
  return null;
}

/** Start of the next attended moment at or after `fromMs` (pickup of a finished plate). */
export function nextAttendedMoment(config: AttendanceConfig, fromMs: number): number | null {
  return nextAttendedSlot(config, fromMs, 0);
}

/**
 * Unattended stretches within [from, to] — the gaps between the windows. Used to
 * paint the "nobody here" bands on the timeline.
 */
export function unattendedIntervals(
  config: AttendanceConfig,
  from: Date,
  to: Date
): Array<{ start: number; end: number }> {
  if (!config.enabled || config.windows.length === 0) return [];

  const attended = attendanceIntervals(config, from, to);
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = from.getTime();

  for (const iv of attended) {
    if (iv.start > cursor) gaps.push({ start: cursor, end: Math.min(iv.start, to.getTime()) });
    cursor = Math.max(cursor, iv.end);
    if (cursor >= to.getTime()) break;
  }
  if (cursor < to.getTime()) gaps.push({ start: cursor, end: to.getTime() });

  return gaps.filter((g) => g.end > g.start);
}
