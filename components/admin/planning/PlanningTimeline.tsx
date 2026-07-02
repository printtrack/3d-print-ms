"use client";

import { Package, Calendar } from "lucide-react";
import {
  parseYMD,
  dayDiff,
  addDays,
  startOfWeek,
  laneOrder,
  packLanes,
  sameDay,
  INTERNAL,
  UNASSIGNED,
  type PlanEntry,
} from "@/lib/planning-entries";
import { cn, barColors, PlanAvatar, BRAND, BRAND_SOFT, useDateNames } from "./shared";

const DAY_W = 44;
const BAR_H = 26;
const BAR_GAP = 15;
const TRACK_PAD = 15;
const NAME_W = 184;
const RANGE_DAYS = 35;

interface Props {
  focus: Date;
  today: Date;
  entries: PlanEntry[];
  teamOrder: string[];
  hideCust: boolean;
  hideCounts: boolean;
  onSelect: (e: PlanEntry) => void;
  activeLabel: (n: number) => string;
}

type Positioned = PlanEntry & { si: number; ei: number; lane: number; nextSi?: number };

function TimelineBar({ e, onClick, hideCust }: { e: Positioned; onClick: (e: PlanEntry) => void; hideCust: boolean }) {
  const si = e.si;
  const ei = e.ei;
  const left = Math.max(si, 0) * DAY_W;
  const rightIdx = Math.min(ei, RANGE_DAYS - 1);
  const width = (rightIdx - Math.max(si, 0) + 1) * DAY_W - 4;
  const contL = si < 0;
  const contR = ei > RANGE_DAYS - 1;
  const top = TRACK_PAD + e.lane * (BAR_H + BAR_GAP);
  const c = barColors(e);
  const isEvent = e.kind === "event" || e.kind === "feed";

  return (
    <button
      className={cn(
        "absolute flex items-center gap-1.5 overflow-hidden whitespace-nowrap border border-l-[3px] px-2 transition hover:brightness-95",
        e.done && "opacity-70"
      )}
      style={{
        left,
        width,
        top,
        height: BAR_H,
        background: c.background,
        borderColor: c.borderColor,
        borderLeftColor: c.accent,
        borderTopLeftRadius: contL ? 0 : 6,
        borderBottomLeftRadius: contL ? 0 : 6,
        borderTopRightRadius: contR ? 0 : 6,
        borderBottomRightRadius: contR ? 0 : 6,
      }}
      onClick={() => onClick(e)}
      title={isEvent ? e.title : `${e.title} · ${e.customer}`}
    >
      {contL && <span className="shrink-0 font-bold opacity-50">‹</span>}
      {isEvent && <Calendar className="h-3 w-3 shrink-0 opacity-60" />}
      <span className="overflow-hidden text-ellipsis text-[12px] font-semibold text-foreground">{e.title}</span>
      {!isEvent && !hideCust && (
        <span className="overflow-hidden text-ellipsis text-[11px] text-muted-foreground">{e.customer}</span>
      )}
      {contR && <span className="shrink-0 font-bold opacity-50">›</span>}
    </button>
  );
}

function MilestoneDiamond({ m, onClick }: { m: Positioned & { idx: number }; onClick: (e: PlanEntry) => void }) {
  const left = m.idx * DAY_W + DAY_W / 2;
  const top = TRACK_PAD + m.lane * (BAR_H + BAR_GAP) + 1;
  return (
    <button
      className="absolute z-[4] h-[13px] w-[13px] rounded-[3px] border-[2.5px] shadow-sm transition hover:scale-125"
      style={{
        left,
        top,
        transform: "translate(-50%, -50%) rotate(45deg)",
        background: m.done ? "#22c55e" : "var(--card)",
        borderColor: m.done ? "#22c55e" : m.overdue ? "#ef4444" : "#7c3aed",
        boxShadow: m.overdue ? "0 0 0 2px rgba(239,68,68,0.22), 0 1px 3px rgba(0,0,0,0.22)" : undefined,
      }}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick(m);
      }}
      title={`${m.title} — ${m.date}`}
    />
  );
}

export function PlanningTimeline({ focus, today, entries, teamOrder, hideCust, hideCounts, onSelect, activeLabel }: Props) {
  const names = useDateNames();
  const rangeStart = startOfWeek(focus);
  const days = Array.from({ length: RANGE_DAYS }, (_, i) => addDays(rangeStart, i));
  const todayIdx = dayDiff(rangeStart, today);
  const lanes = laneOrder(entries, teamOrder);

  const byOwner: Record<string, PlanEntry[]> = {};
  for (const e of entries) (byOwner[e.owner] ||= []).push(e);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: NAME_W + RANGE_DAYS * DAY_W, minWidth: "100%" }}>
          {/* header */}
          <div className="flex border-b bg-card">
            <div
              className="sticky left-0 z-10 flex items-center border-r bg-card px-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ width: NAME_W, minHeight: 48 }}
            >
              Team / Tag
            </div>
            <div className="flex shrink-0" style={{ width: RANGE_DAYS * DAY_W }}>
              {days.map((d, i) => {
                const we = d.getDay() === 0 || d.getDay() === 6;
                const isToday = sameDay(d, today);
                const firstOfMonth = d.getDate() === 1 || i === 0;
                return (
                  <div
                    key={i}
                    className={cn("flex flex-col items-center border-r pt-1 pb-1.5", we && "bg-muted/40")}
                    style={{ width: DAY_W, background: isToday ? BRAND_SOFT : undefined }}
                  >
                    <span className="h-[11px] text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--brand-accent-dim)" }}>
                      {firstOfMonth ? names.monthShort(d.getMonth()) : ""}
                    </span>
                    <span className="h-3 text-[10px] font-semibold text-muted-foreground">{names.weekdayNarrow(d)}</span>
                    <span
                      className={cn("inline-flex h-5 w-[21px] items-center justify-center text-[13px] font-semibold", isToday && "rounded-full text-white")}
                      style={isToday ? { background: BRAND } : undefined}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* rows */}
          {lanes.map((name) => {
            const laneEntries = byOwner[name] || [];
            const barItems = laneEntries
              .filter((e) => e.kind !== "milestone")
              .map((e) => ({ ...e, si: dayDiff(rangeStart, parseYMD(e.start)), ei: dayDiff(rangeStart, parseYMD(e.end)) }))
              .filter((e) => e.ei >= 0 && e.si <= RANGE_DAYS - 1);
            const { items: packedBars, lanes: barLanesRaw } = packLanes(barItems);
            const barLanes = barItems.length ? barLanesRaw : 0;
            const barByOrder: Record<string, Positioned> = {};
            (packedBars as Positioned[]).forEach((b) => {
              if (b.orderId) barByOrder[b.orderId] = b;
            });

            const diamonds: (Positioned & { idx: number })[] = [];
            const orphanMs: PlanEntry[] = [];
            laneEntries
              .filter((e) => e.kind === "milestone")
              .forEach((m) => {
                const idx = dayDiff(rangeStart, parseYMD(m.date));
                const parent = m.orderId ? barByOrder[m.orderId] : null;
                if (parent && idx >= 0 && idx <= RANGE_DAYS - 1) {
                  diamonds.push({ ...m, idx, si: idx, ei: idx, lane: parent.lane });
                } else {
                  orphanMs.push(m);
                }
              });

            const orphanItems = orphanMs
              .map((e) => ({ ...e, si: dayDiff(rangeStart, parseYMD(e.start)), ei: dayDiff(rangeStart, parseYMD(e.end)) }))
              .filter((e) => e.ei >= 0 && e.si <= RANGE_DAYS - 1);
            const { items: packedOrphan, lanes: orphanLanes } = packLanes(orphanItems);
            (packedOrphan as Positioned[]).forEach((m) => {
              m.lane += barLanes;
            });

            const laneCount = Math.max(1, barLanes + (orphanItems.length ? orphanLanes : 0));
            const trackH = TRACK_PAD * 2 + laneCount * (BAR_H + BAR_GAP) - BAR_GAP;
            const activeCount = laneEntries.filter((e) => e.kind === "deadline" && !e.done).length;
            const internal = name === INTERNAL || name === UNASSIGNED;
            const isFeedLane = laneEntries.length > 0 && laneEntries.every((e) => e.kind === "feed");

            return (
              <div key={name} className="flex border-b last:border-b-0" style={{ height: trackH }}>
                <div className="sticky left-0 z-[9] flex items-center gap-2.5 border-r bg-card px-3.5" style={{ width: NAME_W }}>
                  {internal || isFeedLane ? (
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {isFeedLane ? <Calendar className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                    </span>
                  ) : (
                    <PlanAvatar name={name} />
                  )}
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">{name}</span>
                    {!hideCounts && !isFeedLane && (
                      <span className="text-[11px] text-muted-foreground">{activeCount > 0 ? activeLabel(activeCount) : "—"}</span>
                    )}
                  </div>
                </div>
                <div
                  className="relative shrink-0"
                  style={{
                    width: RANGE_DAYS * DAY_W,
                    height: trackH,
                    backgroundImage: "linear-gradient(90deg, var(--border) 1px, transparent 1px)",
                    backgroundSize: `${DAY_W}px 100%`,
                  }}
                >
                  {days.map((d, i) => {
                    const we = d.getDay() === 0 || d.getDay() === 6;
                    if (!we) return null;
                    return <div key={i} className="absolute top-0 bottom-0 bg-muted/40" style={{ left: i * DAY_W, width: DAY_W }} />;
                  })}
                  {todayIdx >= 0 && todayIdx < RANGE_DAYS && (
                    <div className="absolute top-0 bottom-0 z-[1] w-0.5" style={{ left: todayIdx * DAY_W, background: BRAND }} />
                  )}
                  {(packedBars as Positioned[]).map((e) => (
                    <TimelineBar key={e.id} e={e} onClick={onSelect} hideCust={hideCust} />
                  ))}
                  {(packedOrphan as Positioned[]).map((e) => (
                    <TimelineBar key={e.id} e={e} onClick={onSelect} hideCust={hideCust} />
                  ))}
                  {diamonds.map((m) => (
                    <MilestoneDiamond key={m.id} m={m} onClick={onSelect} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
