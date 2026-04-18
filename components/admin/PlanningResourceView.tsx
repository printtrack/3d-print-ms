"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES_SHORT,
  MONTH_NAMES_LONG,
  getMondayOfWeek,
  getWeekDays,
  isToday,
  ViewMode,
  RULER_H,
  barLeft,
  getViewStart,
  getViewDays,
} from "@/lib/gantt-utils";
import type { PlanningOrder } from "./PlanningView";

const LABEL_COL_W = 200;
const ROW_H = 56;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PlanningResourceViewProps {
  orders: PlanningOrder[];
  users: User[];
  viewMode: ViewMode;
  viewDate: Date;
  pxD: number;
}

export function PlanningResourceView({ orders, users, viewMode, viewDate, pxD }: PlanningResourceViewProps) {
  const router = useRouter();

  const viewStart = getViewStart(viewMode, viewDate);
  const totalDays = getViewDays(viewMode, viewDate);
  const totalWidth = totalDays * pxD;

  const todayLine = (() => {
    const now = new Date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const left = ((local.getTime() - viewStart.getTime()) / 86_400_000) * pxD;
    if (left < 0 || left > totalWidth) return null;
    return left;
  })();

  function renderRulerColumns() {
    if (viewMode === "week") {
      const days = getWeekDays(getMondayOfWeek(viewDate));
      return days.map((day, i) => (
        <div
          key={i}
          className={cn(
            "absolute top-0 flex flex-col items-center justify-start pt-1.5 border-r text-xs font-medium",
            isToday(day) ? "text-primary" : "text-muted-foreground"
          )}
          style={{ left: i * pxD, width: pxD, height: RULER_H }}
        >
          {pxD >= 40 && (
            <span className="text-[10px] leading-none">{DAY_NAMES_SHORT[day.getDay()]}</span>
          )}
          <span className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5",
            isToday(day) ? "bg-primary text-primary-foreground" : ""
          )}>
            {day.getDate()}
          </span>
        </div>
      ));
    }

    const cols: React.ReactNode[] = [];
    let dayOffset = 0;
    const current = new Date(viewStart);
    while (dayOffset < totalDays) {
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const remaining = totalDays - dayOffset;
      const monthDays = Math.min(daysInMonth - (current.getDate() - 1), remaining);
      const monthWidth = monthDays * pxD;

      cols.push(
        <div
          key={`month-${dayOffset}`}
          className="absolute top-0 border-r text-xs font-medium text-muted-foreground"
          style={{ left: dayOffset * pxD, width: monthWidth, height: RULER_H }}
        >
          <div className="px-2 pt-1.5 font-semibold text-foreground">
            {MONTH_NAMES_LONG[current.getMonth()]} {current.getFullYear()}
          </div>
          <div className="relative" style={{ height: 36 }}>
            {Array.from({ length: monthDays }, (_, i) => {
              const day = new Date(current.getFullYear(), current.getMonth(), current.getDate() + i);
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 bottom-0 flex items-center justify-center border-r text-[10px]",
                    isToday(day) ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                  style={{ left: i * pxD, width: pxD }}
                >
                  {pxD >= 20 && (
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      isToday(day) ? "bg-primary text-primary-foreground" : ""
                    )}>
                      {day.getDate()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );

      dayOffset += monthDays;
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }
    return cols;
  }

  function renderGridLines() {
    return Array.from({ length: totalDays + 1 }, (_, i) => (
      <div
        key={i}
        className="absolute top-0 bottom-0 border-r border-border/30 pointer-events-none"
        style={{ left: i * pxD }}
      />
    ));
  }

  function renderUserRow(user: User) {
    const userOrders = orders.filter((o) =>
      o.assignees.some((a) => a.userId === user.id)
    );

    return (
      <div key={user.id} className="flex border-b hover:bg-muted/10 group" style={{ height: ROW_H }}>
        <div
          className="sticky left-0 z-10 bg-background border-r flex items-center px-3 gap-2 flex-shrink-0 group-hover:bg-muted/10"
          style={{ width: LABEL_COL_W, minWidth: LABEL_COL_W }}
        >
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{user.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {user.role === "ADMIN" ? "Admin" : "Teammitglied"}
            </div>
          </div>
        </div>

        <div className="relative flex-1" style={{ width: totalWidth, minWidth: totalWidth }}>
          {renderGridLines()}
          {todayLine !== null && (
            <div
              className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none"
              style={{ left: Math.floor(todayLine / pxD) * pxD, width: pxD }}
            />
          )}
          {todayLine !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-10"
              style={{ left: todayLine }}
            />
          )}

          {userOrders.length === 0 && (
            <div className="absolute inset-0 flex items-center px-3">
              <span className="text-[10px] text-muted-foreground/50">Verfügbar</span>
            </div>
          )}

          {userOrders.map((order) => {
            const startDate = order.createdAt;
            const endDate = order.deadline;
            const rawLeft = barLeft(startDate, viewStart, pxD);
            const rawWidth = endDate
              ? Math.max(pxD * 0.5, ((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) * pxD)
              : 30 * pxD;

            if (rawLeft + rawWidth < 0 || rawLeft > totalWidth) return null;

            const clampedLeft = Math.max(0, rawLeft);
            const width = rawWidth - (clampedLeft - rawLeft);

            return (
              <div
                key={order.id}
                className="absolute top-2 rounded-md cursor-pointer hover:brightness-95 transition-all"
                style={{
                  left: clampedLeft,
                  width,
                  height: ROW_H - 16,
                  backgroundColor: order.phase.color + "33",
                  borderLeft: `3px solid ${order.phase.color}`,
                }}
                onClick={() => router.push(`/admin/orders/${order.id}`)}
                title={order.customerName}
              >
                <div
                  className="px-1.5 h-full flex items-center text-xs font-medium truncate"
                  style={{ color: order.phase.color }}
                >
                  {width > 60 && order.customerName}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto relative min-h-0">
      <h2 className="sr-only">Ressourcen</h2>
      <div style={{ width: LABEL_COL_W + totalWidth, minWidth: "100%" }}>
        {/* Sticky ruler */}
        <div
          className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b flex"
          style={{ height: RULER_H }}
        >
          <div
            className="sticky left-0 z-30 bg-muted/80 backdrop-blur-sm border-r flex items-center px-3 text-xs font-medium text-muted-foreground flex-shrink-0"
            style={{ width: LABEL_COL_W, minWidth: LABEL_COL_W }}
          >
            Teammitglied
          </div>
          <div className="relative flex-1" style={{ width: totalWidth, minWidth: totalWidth }}>
            {renderRulerColumns()}
            {todayLine !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none"
                style={{ left: todayLine }}
              />
            )}
          </div>
        </div>

        {users.map(renderUserRow)}
      </div>
    </div>
  );
}
