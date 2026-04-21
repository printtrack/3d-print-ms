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
  DAY_NAMES_SHORT,
  MONTH_NAMES,
  MONTH_NAMES_LONG,
  isToday,
} from "@/lib/gantt-utils";
import { getRulerMode } from "@/lib/timeline-ruler";

// ── Context ───────────────────────────────────────────────────────────────────

export interface GanttContextValue {
  viewMode: ViewMode;
  originMs: number;
  contentWidth: number;
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
  const { originMs, contentWidth, pxD } = useGanttContext();
  const msPerPx = 86_400_000 / pxD;
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const firstMidnight = startOfDay(originMs);
  const lines: number[] = [];
  let t = firstMidnight;
  while (t <= originMs + contentWidth * msPerPx + 86_400_000) {
    const x = (t - originMs) / msPerPx;
    if (x >= -1) lines.push(x);
    t += 86_400_000;
  }
  return (
    <>
      {lines.map((x, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none"
          style={{ left: x }}
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

interface PinchState {
  initialDistance: number;
  initialPxD: number;
  midpointX: number;
  originMsAtPinchStart: number;
}

interface PanDragState {
  startClientX: number;
  originMsAtStart: number;
}

interface GanttShellProps {
  children: React.ReactNode;
}

export function GanttShell({ children }: GanttShellProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [originMs, setOriginMs] = useState(() => {
    // Start so today is near left edge (10% from left)
    return Date.now() - 3 * 86_400_000;
  });
  const [pxD, setPxD] = useState(DEFAULT_PX_D.month);
  const [containerWidth, setContainerWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pxDRef = useRef(pxD);
  const originMsRef = useRef(originMs);
  const hasDraggedRef = useRef(false);
  const panDragRef = useRef<PanDragState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { pxDRef.current = pxD; }, [pxD]);
  useEffect(() => { originMsRef.current = originMs; }, [originMs]);

  // ResizeObserver to track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const contentWidth = containerWidth;

  const todayLine = mounted ? (() => {
    const now = new Date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (local.getTime() - originMs) / (86_400_000 / pxD);
  })() : null;

  function navigate(dir: -1 | 1) {
    const stepMs =
      viewMode === "week" ? 7 * 86_400_000 :
      viewMode === "month" ? 30 * 86_400_000 :
      90 * 86_400_000;
    setOriginMs((o) => o + dir * stepMs);
  }

  function goToday() {
    setOriginMs(Date.now() - (contentWidth / pxDRef.current / 2) * 86_400_000);
  }

  function resetZoom() {
    const newPxD = DEFAULT_PX_D[viewMode];
    setPxD(newPxD);
    pxDRef.current = newPxD;
    setOriginMs(Date.now() - (contentWidth / newPxD / 2) * 86_400_000);
  }

  // Nav label from visible range
  const navLabel = (() => {
    if (!mounted || contentWidth === 0) return "";
    const start = new Date(originMs);
    const endMs = originMs + (contentWidth / pxD) * 86_400_000;
    const end = new Date(endMs);
    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.getDate()}. ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()}. ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${start.getDate()}. ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()}. ${MONTH_NAMES[end.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()}. – ${end.getDate()}. ${MONTH_NAMES_LONG[start.getMonth()]} ${start.getFullYear()}`;
  })();

  // Wheel zoom (no Ctrl guard — plain scroll zooms)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const oldPxD = pxDRef.current;
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newPxD = Math.min(MAX_PX_D, Math.max(MIN_PX_D, oldPxD * factor));
    if (newPxD === oldPxD) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const cursorTimeMs = originMsRef.current + (mouseX / oldPxD) * 86_400_000;
    const newOriginMs = cursorTimeMs - (mouseX / newPxD) * 86_400_000;

    originMsRef.current = newOriginMs;
    pxDRef.current = newPxD;
    setOriginMs(newOriginMs);
    setPxD(newPxD);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Mouse drag-pan on empty canvas
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDraggedRef.current = false;
    panDragRef.current = { startClientX: e.clientX, originMsAtStart: originMsRef.current };

    function onMove(me: MouseEvent) {
      if (!panDragRef.current) return;
      const dx = me.clientX - panDragRef.current.startClientX;
      if (Math.abs(dx) > 5) hasDraggedRef.current = true;
      const newOriginMs = panDragRef.current.originMsAtStart - (dx / pxDRef.current) * 86_400_000;
      originMsRef.current = newOriginMs;
      setOriginMs(newOriginMs);
    }

    function onUp() {
      panDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Touch: one-finger pan + two-finger pinch
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const rect = containerRef.current?.getBoundingClientRect();
      const midpointX = rect ? midX - rect.left : midX;
      pinchStateRef.current = {
        initialDistance: dist,
        initialPxD: pxDRef.current,
        midpointX,
        originMsAtPinchStart: originMsRef.current,
      };
      panDragRef.current = null;
    } else if (e.touches.length === 1) {
      pinchStateRef.current = null;
      panDragRef.current = { startClientX: e.touches[0].clientX, originMsAtStart: originMsRef.current };
      hasDraggedRef.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchStateRef.current) {
      const ps = pinchStateRef.current;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / ps.initialDistance;
      const newPxD = Math.min(MAX_PX_D, Math.max(MIN_PX_D, ps.initialPxD * ratio));
      const cursorTimeMs = ps.originMsAtPinchStart + (ps.midpointX / ps.initialPxD) * 86_400_000;
      const newOriginMs = cursorTimeMs - (ps.midpointX / newPxD) * 86_400_000;
      originMsRef.current = newOriginMs;
      pxDRef.current = newPxD;
      setOriginMs(newOriginMs);
      setPxD(newPxD);
    } else if (e.touches.length === 1 && panDragRef.current) {
      const dx = e.touches[0].clientX - panDragRef.current.startClientX;
      if (Math.abs(dx) > 5) hasDraggedRef.current = true;
      const newOriginMs = panDragRef.current.originMsAtStart - (dx / pxDRef.current) * 86_400_000;
      originMsRef.current = newOriginMs;
      setOriginMs(newOriginMs);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStateRef.current = null;
    panDragRef.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ── Ruler rendering ───────────────────────────────────────────────────────

  const BAND_H = 22;
  const rulerMode = getRulerMode(pxD);

  function renderDayCells(topOffset: number, cellHeight: number) {
    if (contentWidth === 0) return null;
    const msPerPx = 86_400_000 / pxD;
    const startMs = originMs;
    const endMs = originMs + contentWidth * msPerPx;

    // Walk days in visible range
    const startDay = new Date(startMs);
    const firstDay = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate());
    const cells: React.ReactNode[] = [];

    let cur = new Date(firstDay);
    while (cur.getTime() <= endMs + 86_400_000) {
      const x = (cur.getTime() - startMs) / msPerPx;
      const day = new Date(cur);
      const isT = isToday(day);
      cells.push(
        <div
          key={cur.getTime()}
          className={cn(
            "absolute flex flex-col items-center justify-center border-r text-[10px]",
            isT ? "text-primary font-bold" : "text-muted-foreground"
          )}
          style={{ left: x, width: pxD, top: topOffset, height: cellHeight }}
        >
          {pxD >= 16 && (
            <>
              {pxD >= 28 && <span className="leading-none">{DAY_NAMES_SHORT[day.getDay()]}</span>}
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                isT ? "bg-primary text-primary-foreground" : ""
              )}>
                {day.getDate()}
              </span>
            </>
          )}
          {pxD < 16 && pxD >= 4 && day.getDate() === 1 && (
            <span className="text-[9px] leading-none rotate-90 origin-center">{day.getDate()}</span>
          )}
        </div>
      );
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }

  function renderMonthBand(top: number, height: number) {
    if (contentWidth === 0) return null;
    const msPerPx = 86_400_000 / pxD;
    const startMs = originMs;
    const endMs = originMs + contentWidth * msPerPx;

    const cells: React.ReactNode[] = [];
    let cur = new Date(startMs);
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);

    while (cur.getTime() <= endMs) {
      const monthStart = cur.getTime();
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const monthEnd = Math.min(nextMonth.getTime(), endMs + 86_400_000);
      const x = Math.max(0, (monthStart - startMs) / msPerPx);
      const w = (monthEnd - Math.max(monthStart, startMs)) / msPerPx;

      const label = w > 50
        ? `${MONTH_NAMES_LONG[cur.getMonth()]} ${cur.getFullYear()}`
        : w > 25
        ? MONTH_NAMES[cur.getMonth()]
        : "";

      cells.push(
        <div
          key={monthStart}
          className="absolute border-r text-[10px] font-semibold text-foreground overflow-hidden flex items-center px-1.5"
          style={{ left: x, width: w, top, height }}
        >
          {label}
        </div>
      );
      cur = nextMonth;
    }
    return cells;
  }

  function renderYearBand(top: number, height: number) {
    if (contentWidth === 0) return null;
    const msPerPx = 86_400_000 / pxD;
    const startMs = originMs;
    const endMs = originMs + contentWidth * msPerPx;

    const cells: React.ReactNode[] = [];
    let year = new Date(startMs).getFullYear() - 1;
    while (new Date(year, 0, 1).getTime() <= endMs) {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year + 1, 0, 1).getTime();
      const x = Math.max(0, (yearStart - startMs) / msPerPx);
      const w = (Math.min(yearEnd, endMs + 86_400_000) - Math.max(yearStart, startMs)) / msPerPx;
      if (w > 0) {
        cells.push(
          <div
            key={year}
            className="absolute border-r text-[10px] font-bold text-foreground overflow-hidden flex items-center px-1.5"
            style={{ left: x, width: w, top, height }}
          >
            {w > 25 ? String(year) : ""}
          </div>
        );
      }
      year++;
    }
    return cells;
  }

  function renderMonthCells(top: number, height: number) {
    if (contentWidth === 0) return null;
    const msPerPx = 86_400_000 / pxD;
    const startMs = originMs;
    const endMs = originMs + contentWidth * msPerPx;

    const cells: React.ReactNode[] = [];
    let cur = new Date(startMs);
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);

    while (cur.getTime() <= endMs) {
      const monthStart = cur.getTime();
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const x = (monthStart - startMs) / msPerPx;
      const w = (nextMonth.getTime() - monthStart) / msPerPx;

      const label = w > 60 ? MONTH_NAMES[cur.getMonth()] : w > 20 ? MONTH_NAMES[cur.getMonth()][0] : "";

      cells.push(
        <div
          key={monthStart}
          className={cn(
            "absolute border-r text-[10px] font-medium overflow-hidden flex items-center justify-center",
            isToday(cur) ? "text-primary" : "text-muted-foreground"
          )}
          style={{ left: x, width: w, top, height }}
        >
          {label}
        </div>
      );
      cur = nextMonth;
    }
    return cells;
  }

  function renderRuler() {
    if (rulerMode === "days") {
      return renderDayCells(0, RULER_H);
    }
    if (rulerMode === "days-band") {
      return (
        <>
          {renderMonthBand(0, BAND_H)}
          {renderDayCells(BAND_H, RULER_H - BAND_H)}
        </>
      );
    }
    // months-band: year on top, month cells below
    return (
      <>
        {renderYearBand(0, BAND_H)}
        {renderMonthCells(BAND_H, RULER_H - BAND_H)}
      </>
    );
  }

  const ctx: GanttContextValue = { viewMode, originMs, contentWidth, pxD, todayLine, containerRef };

  return (
    <GanttContext.Provider value={ctx}>
      {/* Navigation header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-background flex-shrink-0 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[220px] text-center" data-testid="gantt-nav-label">{navLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Vor" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={goToday}>
          Heute
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex items-center rounded-md border overflow-hidden">
          {(["week", "month", "quarter"] as ViewMode[]).map((vm) => (
            <button
              key={vm}
              onClick={() => { setViewMode(vm); }}
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
      <div
        ref={containerRef}
        className="flex-1 overflow-x-hidden overflow-y-auto relative min-h-0"
        style={{ cursor: "grab" }}
        onMouseDown={handleContainerMouseDown}
      >
        <div style={{ minWidth: "100%" }}>
          {/* Sticky ruler */}
          <div
            className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b relative"
            style={{ height: RULER_H, minWidth: "100%" }}
          >
            {renderRuler()}
            {todayLine !== null && todayLine >= 0 && (
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
