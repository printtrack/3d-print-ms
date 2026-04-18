"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ViewMode,
  DEFAULT_PX_D,
  RULER_H,
  MIN_PX_D,
  MAX_PX_D,
  getViewStart,
  getViewDays,
  getNavLabel,
  DAY_NAMES_SHORT,
  MONTH_NAMES_LONG,
  getMondayOfWeek,
  getWeekDays,
  isToday,
} from "@/lib/gantt-utils";

// ── Context ───────────────────────────────────────────────────────────────────

export interface GanttContextValue {
  viewMode: ViewMode;
  viewStart: Date;
  totalDays: number;
  totalWidth: number;
  pxD: number;
  todayLine: number | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const GanttContext = createContext<GanttContextValue | null>(null);

export function useGanttContext(): GanttContextValue {
  const ctx = useContext(GanttContext);
  if (!ctx) throw new Error("useGanttContext must be used within GanttShell");
  return ctx;
}

// ── Shared row helpers ────────────────────────────────────────────────────────

/** Grid lines for a row canvas — call inside the relative canvas div */
export function GanttGridLines() {
  const { totalDays, pxD } = useGanttContext();
  return (
    <>
      {Array.from({ length: totalDays + 1 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none"
          style={{ left: i * pxD }}
        />
      ))}
    </>
  );
}

/** Today column highlight + vertical line — call inside the relative canvas div */
export function GanttTodayLine() {
  const { todayLine, pxD } = useGanttContext();
  if (todayLine === null) return null;
  const dayStart = Math.floor(todayLine / pxD) * pxD;
  return (
    <>
      <div
        className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none"
        style={{ left: dayStart, width: pxD }}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-10"
        style={{ left: todayLine }}
      />
    </>
  );
}

// ── Shell component ───────────────────────────────────────────────────────────

interface GanttShellProps {
  children: React.ReactNode;
}

export function GanttShell({ children }: GanttShellProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [viewDate, setViewDate] = useState(() => new Date());
  const [pxD, setPxD] = useState(DEFAULT_PX_D.month);

  const containerRef = useRef<HTMLDivElement>(null);
  const pxDRef = useRef(pxD);

  useEffect(() => { pxDRef.current = pxD; }, [pxD]);

  const viewStart = getViewStart(viewMode, viewDate);
  const totalDays = getViewDays(viewMode, viewDate);
  const totalWidth = totalDays * pxD;
  const navLabel = getNavLabel(viewMode, viewDate);

  const todayLine = (() => {
    const now = new Date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const left = ((local.getTime() - viewStart.getTime()) / 86_400_000) * pxD;
    if (left < 0 || left > totalWidth) return null;
    return left;
  })();

  function resetZoom() {
    setPxD(DEFAULT_PX_D[viewMode]);
  }

  function navigate(dir: -1 | 1) {
    setViewDate((d) => {
      const next = new Date(d);
      if (viewMode === "week") next.setDate(next.getDate() + dir * 7);
      else if (viewMode === "month") next.setMonth(next.getMonth() + dir);
      else next.setMonth(next.getMonth() + dir * 3);
      return next;
    });
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      const oldPxD = pxDRef.current;
      const newPxD = Math.min(MAX_PX_D, Math.max(MIN_PX_D, oldPxD * factor));
      if (newPxD === oldPxD) return;
      const mouseX = e.clientX - container.getBoundingClientRect().left;
      const contentX = mouseX + container.scrollLeft;
      container.scrollLeft = Math.max(0, (contentX / oldPxD) * newPxD - mouseX);
      setPxD(newPxD);
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  function renderRulerColumns() {
    const cols: React.ReactNode[] = [];
    const start = new Date(viewStart);

    if (viewMode === "week") {
      const days = getWeekDays(start);
      return days.map((day, i) => (
        <div
          key={i}
          className={cn(
            "absolute top-0 flex flex-col items-center justify-start pt-1.5 border-r text-xs font-medium",
            isToday(day) ? "text-primary" : "text-muted-foreground"
          )}
          style={{ left: i * pxD, width: pxD, height: RULER_H }}
        >
          {pxD >= 40 && <span className="text-[10px] leading-none">{DAY_NAMES_SHORT[day.getDay()]}</span>}
          <span className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5",
            isToday(day) ? "bg-primary text-primary-foreground" : ""
          )}>
            {day.getDate()}
          </span>
        </div>
      ));
    }

    let dayOffset = 0;
    const current = new Date(start);
    while (dayOffset < totalDays) {
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const remaining = totalDays - dayOffset;
      const monthDays = Math.min(daysInMonth - (current.getDate() - 1), remaining);
      const monthWidth = monthDays * pxD;

      cols.push(
        <div
          key={`month-${dayOffset}`}
          className="absolute top-0 border-r text-xs font-medium text-muted-foreground overflow-hidden"
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
                    "absolute top-0 bottom-0 flex flex-col items-center justify-center border-r text-[10px]",
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

  const ctx: GanttContextValue = { viewMode, viewStart, totalDays, totalWidth, pxD, todayLine, containerRef };

  return (
    <GanttContext.Provider value={ctx}>
      {/* Navigation header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-background flex-shrink-0 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[220px] text-center">{navLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Vor" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setViewDate(new Date())}>
          Heute
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex items-center rounded-md border overflow-hidden">
          {(["week", "month", "quarter"] as ViewMode[]).map((vm) => (
            <button
              key={vm}
              onClick={() => { setViewMode(vm); setPxD(DEFAULT_PX_D[vm]); }}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                viewMode === vm
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {vm === "week" ? "Woche" : vm === "month" ? "Monat" : "Quartal"}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetZoom} title="Zoom zurücksetzen">
          1:1
        </Button>
      </div>

      {/* Scrollable Gantt area */}
      <div ref={containerRef} className="flex-1 overflow-auto relative min-h-0">
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Sticky ruler */}
          <div
            className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b relative"
            style={{ height: RULER_H, width: totalWidth, minWidth: "100%" }}
          >
            {renderRulerColumns()}
            {todayLine !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none"
                style={{ left: todayLine }}
              />
            )}
          </div>

          {children}
        </div>
      </div>
    </GanttContext.Provider>
  );
}
