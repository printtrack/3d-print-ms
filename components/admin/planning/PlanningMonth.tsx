"use client";

import { Flag } from "lucide-react";
import {
  parseYMD,
  dayDiff,
  addDays,
  startOfWeek,
  startOfMonth,
  sameDay,
  ymd,
  packLanes,
  type PlanEntry,
} from "@/lib/planning-entries";
import { cn, barColors, BRAND, BRAND_SOFT, useDateNames } from "./shared";

const M_BAR_H = 20;
const M_BAR_GAP = 15;
const M_DATE_H = 26;

interface Props {
  focus: Date;
  today: Date;
  entries: PlanEntry[];
  onSelect: (e: PlanEntry) => void;
}

type Seg = PlanEntry & { segStart: number; segEnd: number; contL: boolean; contR: boolean; si: number; ei: number; lane: number };

function MonthBar({ e, onClick }: { e: Seg; onClick: (e: PlanEntry) => void }) {
  const leftPct = (e.segStart / 7) * 100;
  const widthPct = ((e.segEnd - e.segStart + 1) / 7) * 100;
  const top = M_DATE_H + e.lane * (M_BAR_H + M_BAR_GAP);
  const isMs = e.kind === "milestone";
  const c = barColors(e);
  return (
    <button
      className={cn(
        "pointer-events-auto absolute flex items-center gap-1.5 overflow-hidden whitespace-nowrap border border-l-[3px] px-1.5 text-[11px] font-medium text-foreground transition hover:brightness-95",
        e.done && "line-through opacity-70"
      )}
      style={{
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        top,
        height: M_BAR_H,
        background: isMs ? "var(--card)" : c.background,
        borderColor: c.borderColor,
        borderLeftColor: c.accent,
        borderStyle: isMs ? "dashed" : "solid",
        borderLeftStyle: "solid",
        borderTopLeftRadius: e.contL ? 0 : 5,
        borderBottomLeftRadius: e.contL ? 0 : 5,
        borderTopRightRadius: e.contR ? 0 : 5,
        borderBottomRightRadius: e.contR ? 0 : 5,
      }}
      onClick={() => onClick(e)}
      title={isMs ? e.title : `${e.title} · ${e.customer}`}
    >
      {isMs ? (
        <Flag className="h-2.5 w-2.5 shrink-0" style={{ color: e.overdue ? "#b42318" : "#7c3aed" }} />
      ) : (
        !e.contL && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.overdue ? "#ef4444" : e.color }} />
      )}
      <span className="overflow-hidden text-ellipsis">{e.title}</span>
    </button>
  );
}

function MonthDiamond({ m, col, onClick }: { m: Seg & { col: number }; col: number; onClick: (e: PlanEntry) => void }) {
  const left = `${((col + 0.5) / 7) * 100}%`;
  const top = M_DATE_H + m.lane * (M_BAR_H + M_BAR_GAP) + 1;
  return (
    <button
      className="pointer-events-auto absolute z-[3] h-3 w-3 rounded-[3px] border-[2.5px] shadow-sm transition hover:scale-125"
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

export function PlanningMonth({ focus, today, entries, onSelect }: Props) {
  const names = useDateNames();
  const first = startOfMonth(focus);
  const gridStart = startOfWeek(first);
  let weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  if (weeks[5].every((d) => d.getMonth() !== focus.getMonth())) weeks = weeks.slice(0, 5);

  const weekdayHeads = Array.from({ length: 7 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b">
        {weekdayHeads.map((d, i) => (
          <div
            key={i}
            className={cn("px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", (i === 5 || i === 6) && "text-muted-foreground/70")}
          >
            {names.weekdayShort(d)}
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        {weeks.map((week, wi) => {
          const wStart = week[0];
          const wEnd = week[6];

          const barSegs: Seg[] = [];
          for (const e of entries) {
            if (e.kind === "milestone") continue;
            const s = parseYMD(e.start);
            const en = parseYMD(e.end);
            if (en < wStart || s > wEnd) continue;
            const segStart = Math.max(0, dayDiff(wStart, s));
            const segEnd = Math.min(6, dayDiff(wStart, en));
            barSegs.push({ ...e, segStart, segEnd, contL: s < wStart, contR: en > wEnd, si: segStart, ei: segEnd, lane: 0 });
          }
          const { items: packedBars, lanes: barLanesRaw } = packLanes(barSegs);
          const barLanes = barSegs.length ? barLanesRaw : 0;
          const segByOrder: Record<string, Seg> = {};
          (packedBars as Seg[]).forEach((b) => {
            if (b.orderId) segByOrder[b.orderId] = b;
          });

          const diamonds: (Seg & { col: number })[] = [];
          const orphan: Seg[] = [];
          for (const m of entries) {
            if (m.kind !== "milestone") continue;
            const md = parseYMD(m.date);
            if (md < wStart || md > wEnd) continue;
            const col = dayDiff(wStart, md);
            const parent = m.orderId ? segByOrder[m.orderId] : null;
            if (parent) diamonds.push({ ...m, col, segStart: col, segEnd: col, contL: false, contR: false, si: col, ei: col, lane: parent.lane });
            else orphan.push({ ...m, segStart: col, segEnd: col, contL: false, contR: false, si: col, ei: col, lane: 0 });
          }
          const { items: packedOrphan, lanes: orphanLanes } = packLanes(orphan);
          (packedOrphan as Seg[]).forEach((m) => {
            m.lane += barLanes;
          });

          const laneCount = Math.max(1, barLanes + (orphan.length ? orphanLanes : 0));
          const rowH = M_DATE_H + laneCount * (M_BAR_H + M_BAR_GAP) + 6;

          return (
            <div key={wi} className="relative border-b last:border-b-0" style={{ minHeight: Math.max(104, rowH) }}>
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((d) => {
                  const inMonth = d.getMonth() === focus.getMonth();
                  const isToday = sameDay(d, today);
                  const we = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={ymd(d)}
                      className={cn("border-r p-1.5 last:border-r-0", we && "bg-muted/40", !inMonth && "bg-muted/25")}
                      style={{ background: isToday ? BRAND_SOFT : undefined }}
                    >
                      <div className="flex px-0.5 pt-0.5">
                        <span
                          className={cn(
                            "inline-flex h-[22px] w-[22px] items-center justify-center text-[12.5px] font-medium",
                            isToday && "rounded-full font-semibold text-white",
                            !inMonth && !isToday && "text-muted-foreground/60"
                          )}
                          style={isToday ? { background: BRAND } : undefined}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none relative h-full">
                {(packedBars as Seg[]).map((e) => (
                  <MonthBar key={e.id} e={e} onClick={onSelect} />
                ))}
                {(packedOrphan as Seg[]).map((e) => (
                  <MonthBar key={e.id} e={e} onClick={onSelect} />
                ))}
                {diamonds.map((m) => (
                  <MonthDiamond key={m.id} m={m} col={m.col} onClick={onSelect} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
