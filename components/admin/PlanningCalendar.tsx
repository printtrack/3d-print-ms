"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MONTH_NAMES_LONG, DAY_NAMES_SHORT, isToday } from "@/lib/gantt-utils";
import type { PlanningOrder } from "./PlanningView";

interface PlanningCalendarProps {
  orders: PlanningOrder[];
  viewDate: Date;
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MAX_VISIBLE_LANES = 3;

function toDateOnly(d: Date | string): Date {
  const parsed = typeof d === "string" ? new Date(d) : d;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dateCmp(a: Date, b: Date): number {
  if (a.getFullYear() !== b.getFullYear()) return a.getFullYear() - b.getFullYear();
  if (a.getMonth() !== b.getMonth()) return a.getMonth() - b.getMonth();
  return a.getDate() - b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(toDateOnly(d), diff);
}

function getCalendarWeeks(viewDate: Date): Date[][] {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const lastOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const start = getMondayOf(firstOfMonth);
  const weeks: Date[][] = [];
  let cur = toDateOnly(start);
  while (dateCmp(cur, lastOfMonth) <= 0) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(cur, i));
    }
    weeks.push(week);
    cur = addDays(cur, 7);
  }
  return weeks;
}

function orderSpansDay(order: PlanningOrder, day: Date): boolean {
  const start = toDateOnly(order.createdAt);
  const rawEnd = order.deadline;
  const end = rawEnd ? toDateOnly(rawEnd) : addDays(start, 30);
  return dateCmp(day, start) >= 0 && dateCmp(day, end) <= 0;
}

function assignWeekLanes(weekOrders: PlanningOrder[], week: Date[]): Map<string, number> {
  const weekStart = week[0];
  const weekEnd = week[6];
  const lanes = new Map<string, number>();
  const laneEnds = new Map<number, Date>();

  const sorted = [...weekOrders].sort((a, b) => {
    const sa = toDateOnly(a.createdAt);
    const sb = toDateOnly(b.createdAt);
    const startA = dateCmp(sa, weekStart) < 0 ? weekStart : sa;
    const startB = dateCmp(sb, weekStart) < 0 ? weekStart : sb;
    return dateCmp(startA, startB);
  });

  for (const order of sorted) {
    const rawEnd = order.deadline;
    const orderEnd = rawEnd ? toDateOnly(rawEnd) : addDays(toDateOnly(order.createdAt), 30);
    const visEnd = dateCmp(orderEnd, weekEnd) > 0 ? weekEnd : orderEnd;
    const orderStart = toDateOnly(order.createdAt);
    const visStart = dateCmp(orderStart, weekStart) < 0 ? weekStart : orderStart;

    let lane = 0;
    while (true) {
      const laneEnd = laneEnds.get(lane);
      if (!laneEnd || dateCmp(visStart, addDays(laneEnd, 1)) >= 0) break;
      lane++;
    }
    lanes.set(order.id, lane);
    laneEnds.set(lane, visEnd);
  }

  return lanes;
}

function getOrderColSpan(
  order: PlanningOrder,
  week: Date[]
): { colStart: number; colEnd: number; startsHere: boolean; endsHere: boolean } {
  const weekStart = week[0];
  const weekEnd = week[6];
  const orderStart = toDateOnly(order.createdAt);
  const rawEnd = order.deadline;
  const orderEnd = rawEnd ? toDateOnly(rawEnd) : addDays(orderStart, 30);

  const visStart = dateCmp(orderStart, weekStart) < 0 ? weekStart : orderStart;
  const visEnd = dateCmp(orderEnd, weekEnd) > 0 ? weekEnd : orderEnd;

  const colStart = week.findIndex((d) => dateCmp(d, visStart) === 0) + 1;
  const colEnd = week.findIndex((d) => dateCmp(d, visEnd) === 0) + 2;

  return {
    colStart,
    colEnd,
    startsHere: dateCmp(orderStart, weekStart) >= 0,
    endsHere: dateCmp(orderEnd, weekEnd) <= 0,
  };
}

export function PlanningCalendar({ orders, viewDate }: PlanningCalendarProps) {
  const router = useRouter();

  const weeks = getCalendarWeeks(viewDate);
  const currentMonth = viewDate.getMonth();

  return (
    <div className="flex flex-col flex-1 min-h-0 font-sans">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/30 flex-shrink-0">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r last:border-r-0",
              i >= 5 && "text-muted-foreground/60"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEnd = week[6];

          const weekOrders = orders.filter((o) =>
            week.some((day) => orderSpansDay(o, day))
          );
          const lanes = assignWeekLanes(weekOrders, week);

          // Milestones per day
          const milestonesPerDay = week.map((day) => {
            const hits: { name: string; color: string }[] = [];
            for (const order of orders) {
              for (const m of order.milestones) {
                if (!m.dueAt) continue;
                const mDay = toDateOnly(m.dueAt);
                if (dateCmp(mDay, day) === 0) {
                  hits.push({ name: m.name, color: m.color });
                }
              }
            }
            return hits;
          });

          // Max lane used
          const maxLane = weekOrders.reduce((m, o) => Math.max(m, lanes.get(o.id) ?? 0), -1);

          // Build overflow count per day (lanes > MAX_VISIBLE_LANES - 1)
          const overflowPerDay = week.map((day) => {
            let count = 0;
            for (const order of weekOrders) {
              if (!orderSpansDay(order, day)) continue;
              const lane = lanes.get(order.id) ?? 0;
              if (lane >= MAX_VISIBLE_LANES) count++;
            }
            return count;
          });

          // Orders visible (lane < MAX_VISIBLE_LANES)
          const visibleOrders = weekOrders.filter(
            (o) => (lanes.get(o.id) ?? 0) < MAX_VISIBLE_LANES
          );

          return (
            <div
              key={wi}
              className="grid grid-cols-7 border-b relative overflow-hidden"
              style={{ minHeight: 100 }}
            >
              {/* Day cells (for day numbers, backgrounds, milestones, overflow) */}
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === currentMonth;
                const todayCell = isToday(day);
                const isWeekend = di >= 5;
                const isFirst = day.getDate() === 1;

                return (
                  <div
                    key={di}
                    className={cn(
                      "relative border-r last:border-r-0 pt-1 pb-1 px-1 flex flex-col",
                      isWeekend && "bg-muted/10",
                      todayCell && "bg-primary/5"
                    )}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-end gap-1 px-0.5 mb-0.5 flex-shrink-0">
                      {isFirst && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-0.5">
                          {MONTH_NAMES_LONG[day.getMonth()].slice(0, 3)}
                        </span>
                      )}
                      <span
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium",
                          todayCell
                            ? "bg-primary text-primary-foreground font-bold"
                            : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Milestone dots */}
                    {milestonesPerDay[di].length > 0 && (
                      <div className="flex flex-wrap gap-0.5 px-0.5 mt-auto pt-1">
                        {milestonesPerDay[di].map((m, mi) => (
                          <div
                            key={mi}
                            className="w-2 h-2 flex-shrink-0"
                            style={{
                              backgroundColor: m.color,
                              transform: "rotate(45deg)",
                              borderRadius: 1,
                            }}
                            title={m.name}
                          />
                        ))}
                      </div>
                    )}

                    {/* Overflow indicator */}
                    {overflowPerDay[di] > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1 mt-auto">
                        +{overflowPerDay[di]} mehr
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Event bars layer — absolutely positioned over the cells using CSS grid */}
              <div
                className="col-span-7 row-start-1 pointer-events-none"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gridAutoRows: "24px",
                  paddingTop: 26, // below day number row
                  gap: "2px 0",
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                }}
              >
                {visibleOrders.map((order) => {
                  const { colStart, colEnd, startsHere, endsHere } = getOrderColSpan(order, week);
                  const lane = (lanes.get(order.id) ?? 0) + 1; // CSS grid rows are 1-indexed

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={cn(
                        "flex items-center text-white text-[11px] font-medium px-2 truncate pointer-events-auto h-[22px] self-center transition-opacity hover:opacity-80",
                        startsHere ? "rounded-l-full pl-2" : "pl-1",
                        endsHere ? "rounded-r-full pr-2" : "pr-0"
                      )}
                      style={{
                        gridColumn: `${colStart} / ${colEnd}`,
                        gridRow: lane,
                        backgroundColor: order.phase.color + "dd",
                        marginLeft: startsHere ? 2 : 0,
                        marginRight: endsHere ? 2 : 0,
                      }}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      title={order.customerName}
                    >
                      {!startsHere && (
                        <span className="mr-1 opacity-70 flex-shrink-0">‹</span>
                      )}
                      <span className="truncate">{order.customerName}</span>
                      {!endsHere && (
                        <span className="ml-1 opacity-70 flex-shrink-0">›</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
