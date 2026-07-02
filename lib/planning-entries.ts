// Unified planning entry model — merges order delivery dates, milestones,
// self-created calendar events and subscribed web-calendar feeds into one list
// that the timeline / month / agenda views render. Pure + framework-free.

import { toLocalDateString } from "@/lib/gantt-utils";
import type { PlanningOrder } from "@/components/admin/PlanningView";
import type { WebCalendarEvent } from "@/lib/web-calendar";

export const UNASSIGNED = "Nicht zugewiesen";
export const INTERNAL = "Intern";
export const EVENT_COLOR = "#64748b";
export const MILESTONE_COLOR = "#8b5cf6";
export const OPEN_BAR_DAYS = 30;

export type EntryKind = "deadline" | "milestone" | "event" | "feed";

export interface PlanEntry {
  kind: EntryKind;
  id: string;
  /** inclusive start, `YYYY-MM-DD` */
  start: string;
  /** inclusive end, `YYYY-MM-DD` */
  end: string;
  /** anchor date used by agenda / overdue logic, `YYYY-MM-DD` */
  date: string;
  title: string;
  /** secondary line — customer, note or feed source */
  customer: string;
  email: string | null;
  phase: { name: string; color: string } | null;
  color: string;
  overdue: boolean;
  done: boolean;
  /** true when the order has no scheduled date (open-ended bar) */
  open: boolean;
  owner: string;
  orderId: string | null;
  orderTitle: string | null;
  assignees: string[];
  tasksDone: number;
  tasksTotal: number;
  note: string | null;
  source: string | null;
  readOnly: boolean;
}

/** Self-created general appointment, serialised from the CalendarEvent model. */
export interface PlanningCalendarEvent {
  id: string;
  title: string;
  note: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  owner: { id: string; name: string } | null;
}

// ── date helpers (local, date-only) ───────────────────────────────────────────

export function ymd(d: Date): string {
  return toLocalDateString(d);
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(x, -wd);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

/** Whole-day difference b − a (rounded, date-only). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((parseYMD(ymd(b)).getTime() - parseYMD(ymd(a)).getTime()) / 86_400_000);
}

/** Relative German label for a due date, relative to `today`. */
export function relLabel(iso: string, today: Date): string {
  const diff = dayDiff(today, parseYMD(iso));
  if (diff === 0) return "heute fällig";
  if (diff === 1) return "morgen fällig";
  if (diff === -1) return "1 Tag überfällig";
  if (diff < 0) return `${-diff} Tage überfällig`;
  return `in ${diff} Tagen`;
}

// ── lane packing (greedy) ─────────────────────────────────────────────────────

export interface LaneItem {
  si: number;
  ei: number;
  lane?: number;
}

export function packLanes<T extends LaneItem>(items: T[]): { items: T[]; lanes: number } {
  const sorted = [...items].sort((a, b) => a.si - b.si || a.ei - b.ei);
  const laneEnds: number[] = [];
  for (const it of sorted) {
    let placed = false;
    for (let l = 0; l < laneEnds.length; l++) {
      if (it.si > laneEnds[l]) {
        it.lane = l;
        laneEnds[l] = it.ei;
        placed = true;
        break;
      }
    }
    if (!placed) {
      it.lane = laneEnds.length;
      laneEnds.push(it.ei);
    }
  }
  return { items: sorted, lanes: Math.max(1, laneEnds.length) };
}

// ── entry construction ────────────────────────────────────────────────────────

function ownerOf(order: PlanningOrder): string {
  if (order.assignees.length) return order.assignees[0].user.name;
  if (order.isInternal || order.generalProject) return INTERNAL;
  return UNASSIGNED;
}

export interface BuildEntriesInput {
  orders: PlanningOrder[];
  events: PlanningCalendarEvent[];
  feedEvents: WebCalendarEvent[];
  today: Date;
}

export function buildEntries({ orders, events, feedEvents, today }: BuildEntriesInput): PlanEntry[] {
  const entries: PlanEntry[] = [];

  for (const o of orders) {
    const assignees = o.assignees.map((a) => a.user.name);
    const owner = ownerOf(o);
    const start = toLocalDateString(new Date(o.createdAt));
    // Effective delivery date for the bar: a manually set deadline always wins.
    // Otherwise the bar reaches the *latest* of the milestone due dates and the
    // system estimate, so every milestone diamond sits on the bar. Without any of
    // these the order gets an open-ended bar.
    const candidateEnds = [
      ...o.milestones.map((m) => m.dueAt).filter((d): d is string => !!d).map((d) => new Date(d).getTime()),
      ...(o.estimatedCompletionAt ? [new Date(o.estimatedCompletionAt).getTime()] : []),
    ];
    const scheduled = o.deadline
      ? new Date(o.deadline)
      : candidateEnds.length
      ? new Date(Math.max(...candidateEnds))
      : null;
    const open = !scheduled;
    const endDate = scheduled ?? addDays(new Date(o.createdAt), OPEN_BAR_DAYS);
    const end = toLocalDateString(endDate);
    const overdue = !open && dayDiff(today, parseYMD(end)) < 0;

    // Order delivery bar.
    entries.push({
      kind: "deadline",
      id: `d-${o.id}`,
      start: start <= end ? start : end,
      end,
      date: end,
      title: o.description || o.customerName,
      customer: o.customerName,
      email: o.customerEmail,
      phase: { name: o.phase.name, color: o.phase.color },
      color: o.phase.color,
      overdue,
      done: false,
      open,
      owner,
      orderId: o.id,
      orderTitle: o.description || o.customerName,
      assignees,
      tasksDone: 0,
      tasksTotal: 0,
      note: null,
      source: null,
      readOnly: false,
    });

    // Milestones attached to the order.
    for (const m of o.milestones) {
      if (!m.dueAt) continue;
      const due = toLocalDateString(new Date(m.dueAt));
      const total = m.tasks.length;
      const doneCount = m.tasks.filter((t) => t.completed).length;
      const complete = m.completedAt != null || (total > 0 && doneCount >= total);
      entries.push({
        kind: "milestone",
        id: `m-${m.id}`,
        start: due,
        end: due,
        date: due,
        title: m.name,
        customer: o.customerName,
        email: o.customerEmail,
        phase: { name: o.phase.name, color: o.phase.color },
        color: MILESTONE_COLOR,
        overdue: !complete && dayDiff(today, parseYMD(due)) < 0,
        done: complete,
        open: false,
        owner,
        orderId: o.id,
        orderTitle: o.description || o.customerName,
        assignees,
        tasksDone: doneCount,
        tasksTotal: total,
        note: m.description,
        source: null,
        readOnly: false,
      });
    }
  }

  // Self-created general appointments.
  for (const ev of events) {
    const start = toLocalDateString(new Date(ev.startAt));
    const end = toLocalDateString(new Date(ev.endAt));
    entries.push({
      kind: "event",
      id: `e-${ev.id}`,
      start: start <= end ? start : end,
      end: end >= start ? end : start,
      date: end >= start ? end : start,
      title: ev.title,
      customer: ev.note || "Allgemeiner Termin",
      email: null,
      phase: null,
      color: ev.color || EVENT_COLOR,
      overdue: false,
      done: false,
      open: false,
      owner: ev.owner?.name ?? INTERNAL,
      orderId: null,
      orderTitle: null,
      assignees: ev.owner ? [ev.owner.name] : [],
      tasksDone: 0,
      tasksTotal: 0,
      note: ev.note,
      source: null,
      readOnly: false,
    });
  }

  // Subscribed web-calendar occurrences (read-only).
  for (const f of feedEvents) {
    entries.push({
      kind: "feed",
      id: f.id,
      start: f.start,
      end: f.end,
      date: f.start,
      title: f.title,
      customer: f.source,
      email: null,
      phase: null,
      color: f.color,
      overdue: false,
      done: false,
      open: false,
      owner: f.source,
      orderId: null,
      orderTitle: null,
      assignees: [],
      tasksDone: 0,
      tasksTotal: 0,
      note: null,
      source: f.source,
      readOnly: true,
    });
  }

  return entries;
}

/** Legend group key for an entry. */
export function groupOf(e: PlanEntry): string {
  if (e.kind === "milestone") return "Meilenstein";
  if (e.kind === "event") return "Termin";
  if (e.kind === "feed") return e.source || "Web-Kalender";
  return e.phase?.name ?? "Auftrag";
}

/** Row order for the resource timeline: team members first, then internal /
 *  unassigned, then one lane per web-calendar feed. */
export function laneOrder(entries: PlanEntry[], teamOrder: string[]): string[] {
  const present = new Set(entries.map((e) => e.owner));
  const lanes = teamOrder.filter((n) => present.has(n));
  for (const special of [UNASSIGNED, INTERNAL]) {
    if (present.has(special)) lanes.push(special);
  }
  // feed lanes (source names not already covered)
  const feedLanes = [...new Set(entries.filter((e) => e.kind === "feed").map((e) => e.owner))];
  for (const f of feedLanes) if (!lanes.includes(f)) lanes.push(f);
  return lanes;
}
