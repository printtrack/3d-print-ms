"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Users,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  buildEntries,
  groupOf,
  startOfWeek,
  addDays,
  MILESTONE_COLOR,
  EVENT_COLOR,
  type PlanEntry,
  type PlanningCalendarEvent,
} from "@/lib/planning-entries";
import type { WebCalendarEvent } from "@/lib/web-calendar";
import { useDateNames } from "./planning/shared";
import { PlanningTimeline } from "./planning/PlanningTimeline";
import { PlanningMonth } from "./planning/PlanningMonth";
import { PlanningAgenda } from "./planning/PlanningAgenda";
import { PlanningDetailPanel } from "./planning/PlanningDetailPanel";
import { PlanningCreateEventDialog } from "./planning/PlanningCreateEventDialog";

export interface PlanningTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  assignees: { user: { id: string; name: string } }[];
  position: number;
}

export interface PlanningMilestone {
  id: string;
  orderId: string | null;
  projectId?: string | null;
  name: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  color: string;
  position: number;
  tasks: PlanningTask[];
}

export interface PlanningOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  description: string;
  isInternal: boolean;
  generalProject: boolean;
  createdAt: string;
  deadline: string | null;
  estimatedCompletionAt: string | null;
  priceEstimate: number | null;
  phase: { id: string; name: string; color: string };
  assignees: { userId: string; user: { id: string; name: string; email: string } }[];
  milestones: PlanningMilestone[];
  parts: {
    printJobParts: {
      printJob: {
        id: string;
        plannedAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        printTimeMinutes: number | null;
        status: string;
        machine: { id: string; name: string };
      };
    }[];
  }[];
  project?: { id: string; name: string } | null;
}

export interface PlanningUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Kept for backward compatibility
export interface PlanningProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  dueAt: string | null;
  completedAt: string | null;
  color: string;
  position: number;
}

export interface PlanningProject {
  id: string;
  name: string;
  projectPhase: { id: string; name: string; color: string };
  deadline: string | null;
  createdAt: string;
  milestones: PlanningProjectMilestone[];
}

type PlanView = "timeline" | "month" | "agenda";

interface ViewOptions {
  hideDone: boolean;
  hideCust: boolean;
  hideCounts: boolean;
}

interface PlanningViewProps {
  initialOrders: PlanningOrder[];
  users: PlanningUser[];
  initialEvents: PlanningCalendarEvent[];
  feedEvents: WebCalendarEvent[];
}

interface LegendItem {
  key: string;
  color: string;
  diamond?: boolean;
}

export function PlanningView({ initialOrders, users, initialEvents, feedEvents }: PlanningViewProps) {
  const t = useTranslations("admin");
  const names = useDateNames();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<PlanView>("timeline");
  const [focus, setFocus] = useState<Date>(() => new Date());
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<PlanEntry | null>(null);
  const [query, setQuery] = useState("");
  const [extraEvents, setExtraEvents] = useState<PlanningCalendarEvent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [opts, setOpts] = useState<ViewOptions>({ hideDone: false, hideCust: false, hideCounts: false });

  // Load persisted preferences on the client (avoids hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const v = localStorage.getItem("planungView3");
    if (v === "timeline" || v === "month" || v === "agenda") setView(v);
    try {
      const o = JSON.parse(localStorage.getItem("planungOpts") || "null");
      if (o) setOpts({ hideDone: !!o.hideDone, hideCust: !!o.hideCust, hideCounts: !!o.hideCounts });
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => localStorage.setItem("planungView3", view), [view]);
  useEffect(() => localStorage.setItem("planungOpts", JSON.stringify(opts)), [opts]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const teamOrder = useMemo(() => users.map((u) => u.name), [users]);

  const allEntries = useMemo(
    () => buildEntries({ orders: initialOrders, events: [...initialEvents, ...extraEvents], feedEvents, today }),
    [initialOrders, initialEvents, extraEvents, feedEvents, today]
  );

  const legend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    const seenPhase = new Set<string>();
    for (const e of allEntries) {
      if (e.kind === "deadline" && e.phase && !seenPhase.has(e.phase.name)) {
        seenPhase.add(e.phase.name);
        items.push({ key: e.phase.name, color: e.phase.color });
      }
    }
    if (allEntries.some((e) => e.kind === "milestone")) items.push({ key: "Meilenstein", color: MILESTONE_COLOR, diamond: true });
    if (allEntries.some((e) => e.kind === "event")) items.push({ key: "Termin", color: EVENT_COLOR });
    const feedSources = new Map<string, string>();
    for (const e of allEntries) if (e.kind === "feed" && e.source) feedSources.set(e.source, e.color);
    for (const [src, color] of feedSources) items.push({ key: src, color });
    return items;
  }, [allEntries]);

  const legendLabel = (key: string) => {
    if (key === "Meilenstein") return t("planning_milestone");
    if (key === "Termin") return t("planning_event");
    return key;
  };

  const toggleOff = (key: string) =>
    setOff((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (off.has(groupOf(e))) return false;
      if (opts.hideDone && e.done) return false;
      if (q && !`${e.title} ${e.customer} ${e.owner}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allEntries, off, query, opts.hideDone]);
  const overdueCount = useMemo(() => allEntries.filter((e) => e.overdue).length, [allEntries]);

  const step = (dir: -1 | 1) =>
    setFocus((f) => (view === "timeline" ? addDays(f, dir * 7) : new Date(f.getFullYear(), f.getMonth() + dir, 1)));

  const title = useMemo(() => {
    if (view === "timeline") {
      const s = startOfWeek(focus);
      const en = addDays(s, 34);
      return `${s.getDate()}. ${names.monthShort(s.getMonth())} – ${en.getDate()}. ${names.monthShort(en.getMonth())} ${en.getFullYear()}`;
    }
    return `${names.monthLong(focus.getMonth())} ${focus.getFullYear()}`;
  }, [view, focus, names]);

  const goOverdue = () => {
    setView("agenda");
    setFocus(new Date());
    setOff(new Set());
  };

  const views: { id: PlanView; label: string; icon: typeof Users }[] = [
    { id: "timeline", label: t("planning_view_timeline"), icon: Users },
    { id: "month", label: t("planning_view_month"), icon: LayoutGrid },
    { id: "agenda", label: t("planning_view_agenda"), icon: List },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-5">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("planning_title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("planning_lede")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("planning_create_event")}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* view segment */}
            <div className="inline-flex gap-0.5 rounded-lg border bg-muted p-0.5">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                    view === v.id && "bg-card text-foreground shadow-sm"
                  )}
                >
                  <v.icon className="h-3.5 w-3.5" /> {v.label}
                </button>
              ))}
            </div>

            {/* search */}
            <div className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border bg-card px-2.5 text-muted-foreground focus-within:border-muted-foreground/50">
              <Search className="h-3.5 w-3.5" />
              <input
                className="w-[168px] bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                placeholder={t("planning_search_ph")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* nav */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] text-center text-[14.5px] font-semibold">{title}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-7" onClick={() => setFocus(new Date())}>
              {t("planning_today")}
            </Button>

            {overdueCount > 0 && (
              <button
                onClick={goOverdue}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold"
                style={{ background: "color-mix(in oklab, var(--destructive) 10%, transparent)", borderColor: "color-mix(in oklab, var(--destructive) 25%, transparent)", color: "var(--destructive)" }}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {t("planning_overdue_count", { count: overdueCount })}
              </button>
            )}

            {/* view options */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> {t("planning_options")}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[250px] p-1.5">
                <div className="px-2.5 pt-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{t("planning_options_less")}</div>
                <OptionRow label={t("planning_opt_hide_done")} checked={opts.hideDone} onToggle={() => setOpts((o) => ({ ...o, hideDone: !o.hideDone }))} />
                <OptionRow label={t("planning_opt_hide_cust")} checked={opts.hideCust} onToggle={() => setOpts((o) => ({ ...o, hideCust: !o.hideCust }))} />
                <OptionRow label={t("planning_opt_hide_counts")} checked={opts.hideCounts} onToggle={() => setOpts((o) => ({ ...o, hideCounts: !o.hideCounts }))} />
              </PopoverContent>
            </Popover>
          </div>

          {/* legend */}
          <div className="flex flex-wrap items-center gap-1.5">
            {legend.map((g) => (
              <button
                key={g.key}
                onClick={() => toggleOff(g.key)}
                className={cn(
                  "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 text-[11.5px] font-medium transition hover:bg-muted",
                  off.has(g.key) && "opacity-40"
                )}
                title={off.has(g.key) ? t("planning_legend_show") : t("planning_legend_hide")}
              >
                <span
                  className={cn("h-2 w-2 shrink-0", g.diamond ? "rotate-45 rounded-[1px]" : "rounded-full")}
                  style={{ background: off.has(g.key) ? "var(--muted-foreground)" : g.color }}
                />
                {legendLabel(g.key)}
              </button>
            ))}
          </div>
        </div>

        {/* Views */}
        {view === "timeline" && (
          <PlanningTimeline
            focus={focus}
            today={today}
            entries={visible}
            teamOrder={teamOrder}
            hideCust={opts.hideCust}
            hideCounts={opts.hideCounts}
            onSelect={setSelected}
            activeLabel={(n) => t("planning_active_count", { count: n })}
          />
        )}
        {view === "month" && <PlanningMonth focus={focus} today={today} entries={visible} onSelect={setSelected} />}
        {view === "agenda" && <PlanningAgenda focus={focus} today={today} entries={visible} hideCust={opts.hideCust} onSelect={setSelected} />}
      </div>

      <PlanningDetailPanel entry={selected} today={today} onClose={() => setSelected(null)} />
      <PlanningCreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        today={today}
        onCreated={(ev) => setExtraEvents((x) => [...x, ev])}
      />
    </div>
  );
}

function OptionRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium hover:bg-muted"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span>{label}</span>
      <Switch checked={checked} className="pointer-events-none" />
    </div>
  );
}
