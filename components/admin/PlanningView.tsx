"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanningResourceView } from "./PlanningResourceView";
import { ViewMode, DEFAULT_PX_D, getNavLabel, MONTH_NAMES_LONG } from "@/lib/gantt-utils";

const PlanningCalendar = dynamic(
  () => import("./PlanningCalendar").then((m) => m.PlanningCalendar),
  { ssr: false }
);

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

interface PlanningViewProps {
  initialOrders: PlanningOrder[];
  users: PlanningUser[];
}

type PlanView = "calendar" | "resource";

export function PlanningView({ initialOrders, users }: PlanningViewProps) {
  const [view, setView] = useState<PlanView>("resource");
  const [orders] = useState<PlanningOrder[]>(initialOrders);

  // Resource view nav state
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [resourceDate, setResourceDate] = useState(() => new Date());
  const [pxD, setPxD] = useState(DEFAULT_PX_D.month);
  const navLabel = getNavLabel(viewMode, resourceDate);

  function navigateResource(dir: -1 | 1) {
    setResourceDate((d) => {
      const next = new Date(d);
      if (viewMode === "week") next.setDate(next.getDate() + dir * 7);
      else if (viewMode === "month") next.setMonth(next.getMonth() + dir);
      else next.setMonth(next.getMonth() + dir * 3);
      return next;
    });
  }

  // Calendar view nav state
  const [calDate, setCalDate] = useState(() => new Date());
  const calLabel = `${MONTH_NAMES_LONG[calDate.getMonth()]} ${calDate.getFullYear()}`;

  function navigateCal(dir: -1 | 1) {
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Single unified header */}
      <div className="flex items-center gap-2 px-6 py-3 border-b flex-shrink-0 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight mr-auto">Planung</h1>

        {/* Calendar nav */}
        {view === "calendar" && (
          <>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCal(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">{calLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCal(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCalDate(new Date())}>
              Heute
            </Button>
            <div className="w-px h-5 bg-border" />
          </>
        )}

        {/* Resource nav */}
        {view === "resource" && (
          <>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateResource(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">{navLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateResource(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setResourceDate(new Date())}>
              Heute
            </Button>
            <div className="w-px h-5 bg-border" />
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
            <div className="w-px h-5 bg-border" />
          </>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "calendar" && "bg-muted")}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Kalender
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "resource" && "bg-muted")}
            onClick={() => setView("resource")}
          >
            <Users className="h-3.5 w-3.5" />
            Ressourcen
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "calendar" && <PlanningCalendar orders={orders} viewDate={calDate} />}
        {view === "resource" && (
          <PlanningResourceView
            orders={orders}
            users={users}
            viewMode={viewMode}
            viewDate={resourceDate}
            pxD={pxD}
          />
        )}
      </div>
    </div>
  );
}
