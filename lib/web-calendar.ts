import * as ical from "node-ical";
import type { VEvent } from "node-ical";
import { prisma } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarSubscriptionLite {
  id: string;
  name: string;
  url: string;
  color: string;
  isActive: boolean;
}

/** A single occurrence of a subscribed web-calendar event, normalised to
 *  local date-only strings so it drops straight into the planning entry model. */
export interface WebCalendarEvent {
  id: string;
  subscriptionId: string;
  title: string;
  /** inclusive start, `YYYY-MM-DD` (local) */
  start: string;
  /** inclusive end, `YYYY-MM-DD` (local) */
  end: string;
  allDay: boolean;
  color: string;
  /** subscription name — shown as the source label */
  source: string;
}

// ── Date helpers (local, date-only) ───────────────────────────────────────────

function toYMDLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ── ICS text cache (in-process, ~15 min) ──────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_SUB = 500;
const FETCH_TIMEOUT_MS = 12_000;

interface CacheEntry {
  text: string;
  fetchedAt: number;
}
const icsCache = new Map<string, CacheEntry>();

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("webcal://")) return "https://" + trimmed.slice("webcal://".length);
  return trimmed;
}

async function fetchIcs(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normalizeUrl(url), {
      signal: controller.signal,
      headers: { "User-Agent": "3dprinting-cms/planning-calendar", Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Keine gültige iCal-Datei (VCALENDAR fehlt)");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns cached ICS text if fresh; otherwise fetches. `forceFresh` skips the cache. */
async function getIcsText(url: string, forceFresh = false): Promise<{ text: string; fromCache: boolean }> {
  const cached = icsCache.get(url);
  if (!forceFresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { text: cached.text, fromCache: true };
  }
  const text = await fetchIcs(url);
  icsCache.set(url, { text, fetchedAt: Date.now() });
  return { text, fromCache: false };
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function occurrences(event: VEvent, from: Date, to: Date): { start: Date; end: Date }[] {
  if (event.rrule) {
    // node-ical expands recurring events, applying RECURRENCE-ID overrides and EXDATE.
    return ical
      .expandRecurringEvent(event, { from, to })
      .map((inst) => ({ start: inst.start as Date, end: (inst.end ?? inst.start) as Date }));
  }
  const start = event.start as Date;
  const end = (event.end ?? event.start) as Date;
  if (!start || end < from || start > to) return [];
  return [{ start, end }];
}

function parseFeed(sub: CalendarSubscriptionLite, icsText: string, from: Date, to: Date): WebCalendarEvent[] {
  const data = ical.sync.parseICS(icsText);
  const out: WebCalendarEvent[] = [];
  for (const key of Object.keys(data)) {
    const comp = data[key];
    if (!comp || comp.type !== "VEVENT") continue;
    const event = comp as VEvent;
    const allDay = event.datetype === "date";
    const title = String(event.summary ?? "").trim() || "Termin";
    for (const occ of occurrences(event, from, to)) {
      if (occ.end < from || occ.start > to) continue;
      // All-day DTEND is exclusive → step back one day for an inclusive end.
      const inclusiveEnd = allDay ? addDays(occ.end, -1) : occ.end;
      const startYMD = toYMDLocal(occ.start);
      let endYMD = toYMDLocal(inclusiveEnd < occ.start ? occ.start : inclusiveEnd);
      if (endYMD < startYMD) endYMD = startYMD;
      out.push({
        id: `feed-${sub.id}-${key}-${startYMD}`,
        subscriptionId: sub.id,
        title,
        start: startYMD,
        end: endYMD,
        allDay,
        color: sub.color,
        source: sub.name,
      });
      if (out.length >= MAX_EVENTS_PER_SUB) return out;
    }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve all active web-calendar subscriptions to concrete event occurrences
 * within [rangeStart, rangeEnd]. Never throws: a failing feed is skipped and its
 * error persisted to `lastError`; successful feeds update `lastFetchedAt`.
 */
export async function fetchSubscriptionEvents(
  subs: CalendarSubscriptionLite[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<WebCalendarEvent[]> {
  const active = subs.filter((s) => s.isActive);
  const results = await Promise.all(
    active.map(async (sub) => {
      try {
        const { text, fromCache } = await getIcsText(sub.url);
        const events = parseFeed(sub, text, rangeStart, rangeEnd);
        if (!fromCache) {
          await prisma.calendarSubscription
            .update({ where: { id: sub.id }, data: { lastFetchedAt: new Date(), lastError: null } })
            .catch(() => {});
        }
        return events;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.calendarSubscription
          .update({ where: { id: sub.id }, data: { lastError: message, lastFetchedAt: new Date() } })
          .catch(() => {});
        return [] as WebCalendarEvent[];
      }
    })
  );
  return results.flat();
}

/**
 * Validate a subscription URL by fetching + parsing it once (bypassing the cache).
 * Returns the number of events found, or throws with a human-readable message.
 */
export async function testSubscriptionUrl(url: string): Promise<{ eventCount: number }> {
  const { text } = await getIcsText(url, true);
  const now = new Date();
  const events = parseFeed(
    { id: "test", name: "test", url, color: "#000", isActive: true },
    text,
    addDays(now, -365),
    addDays(now, 365)
  );
  return { eventCount: events.length };
}
