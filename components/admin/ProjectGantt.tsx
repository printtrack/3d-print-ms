"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FolderKanban, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROW_H,
  LANE_ROW_H,
  OPEN_BAR_DAYS,
  barLeft,
  barWidth,
  assignLanes,
} from "@/lib/gantt-utils";
import { GanttShell, useGanttContext, GanttGridLines, GanttTodayLine } from "./gantt/GanttShell";
import { useGanttResize } from "./gantt/useGanttResize";
import { MilestoneDialog } from "./MilestoneDialog";
import type { PlanningMilestone, PlanningProjectMilestone } from "./PlanningView";
import type { GanttMilestone, GanttOrder } from "./OrderGantt";

export interface GanttProject {
  id: string;
  name: string;
  createdAt: string;
  deadline: string | null;
  projectPhase: { id: string; name: string; color: string };
  milestones: GanttMilestone[];
  orders: GanttOrder[];
}

interface GanttUser {
  id: string;
  name: string;
  email: string;
}

interface ProjectGanttProps {
  initialProjects: GanttProject[];
  users: GanttUser[];
}

function ProjectGanttRows({
  projects,
  onProjectsChange,
  users,
}: {
  projects: GanttProject[];
  onProjectsChange: (projects: GanttProject[]) => void;
  users: GanttUser[];
}) {
  const router = useRouter();
  const { originMs, contentWidth, pxD } = useGanttContext();
  const viewStart = new Date(originMs);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean;
    orderId?: string;
    projectId?: string;
    milestone?: PlanningMilestone | null;
  }>({ open: false });

  const allOrders = projects.flatMap((p) => p.orders);

  const orderPatchUrl = useCallback((id: string) => `/api/admin/orders/${id}`, []);
  const { hasDraggedRef: orderDraggedRef, startResize: startOrderResize } = useGanttResize(
    allOrders,
    (updatedOrders) => {
      onProjectsChange(
        projects.map((p) => ({
          ...p,
          orders: p.orders.map((o) => updatedOrders.find((u) => u.id === o.id) ?? o),
        }))
      );
    },
    pxD,
    orderPatchUrl
  );

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleMilestoneSaved(milestone: PlanningMilestone) {
    if (milestoneDialog.projectId) {
      onProjectsChange(
        projects.map((p) => {
          if (p.id !== milestoneDialog.projectId) return p;
          const pm: GanttMilestone = {
            id: milestone.id,
            name: milestone.name,
            dueAt: milestone.dueAt,
            completedAt: milestone.completedAt,
            color: milestone.color,
            position: milestone.position,
          };
          const existing = p.milestones.find((m) => m.id === milestone.id);
          if (existing) return { ...p, milestones: p.milestones.map((m) => (m.id === milestone.id ? pm : m)) };
          return { ...p, milestones: [...p.milestones, pm] };
        })
      );
    } else {
      onProjectsChange(
        projects.map((p) => ({
          ...p,
          orders: p.orders.map((o) => {
            if (o.id !== milestoneDialog.orderId) return o;
            const existing = o.milestones.find((m) => m.id === milestone.id);
            if (existing) return { ...o, milestones: o.milestones.map((m) => (m.id === milestone.id ? milestone : m)) };
            return { ...o, milestones: [...o.milestones, milestone] };
          }),
        }))
      );
    }
  }

  function handleMilestoneDeleted(milestoneId: string) {
    if (milestoneDialog.projectId) {
      onProjectsChange(
        projects.map((p) => ({ ...p, milestones: p.milestones.filter((m) => m.id !== milestoneId) }))
      );
    } else {
      onProjectsChange(
        projects.map((p) => ({
          ...p,
          orders: p.orders.map((o) => ({ ...o, milestones: o.milestones.filter((m) => m.id !== milestoneId) })),
        }))
      );
    }
  }

  const editingMilestone = milestoneDialog.milestone as PlanningMilestone | null | undefined;

  return (
    <>
      {projects.map((project) => {
        const color = project.projectPhase?.color ?? "#6366f1";
        const isCollapsed = collapsedIds.has(project.id);

        // Project bar
        const projRawLeft = barLeft(project.createdAt, viewStart, pxD);
        const projRawWidth = project.deadline
          ? barWidth(project.createdAt, project.deadline, pxD)
          : OPEN_BAR_DAYS * pxD;
        const projLeft = Math.max(0, projRawLeft);
        const projWidth = projRawWidth - (projLeft - projRawLeft);
        const projBarVisible = projLeft + projWidth > 0;

        // Order lanes inside this project
        const lanes = assignLanes(project.orders, viewStart, pxD);
        const maxLane = project.orders.reduce((m, o) => Math.max(m, lanes.get(o.id) ?? 0), 0);
        const byLane = new Map<number, GanttOrder[]>();
        for (let l = 0; l <= maxLane; l++) byLane.set(l, []);
        for (const order of project.orders) {
          const lane = lanes.get(order.id) ?? 0;
          byLane.get(lane)!.push(order);
        }

        return (
          <div key={project.id}>
            {/* Project header row */}
            <div
              className="relative border-b hover:bg-muted/10 group"
              style={{ height: ROW_H, minWidth: "100%", background: color + "08", borderLeft: `3px solid ${color}` }}
            >
              <GanttGridLines />
              <GanttTodayLine />

              {/* Inline project label at left edge */}
              <div
                className="absolute left-2 top-0 bottom-0 flex items-center gap-1.5 z-10 pointer-events-none"
                style={{ maxWidth: 220 }}
              >
                <button
                  type="button"
                  className="flex-shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors pointer-events-auto"
                  onClick={() => toggleCollapsed(project.id)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
                <div
                  className="min-w-0 cursor-pointer pointer-events-auto"
                  onClick={() => router.push(`/admin/projects/${project.id}`)}
                >
                  <div className="text-xs font-semibold truncate leading-tight" style={{ color }}>{project.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {project.milestones.length > 0
                      ? `${project.milestones.filter((m) => m.completedAt).length}/${project.milestones.length} Meilensteine`
                      : `${project.orders.length} Aufträge`}
                  </div>
                </div>
              </div>

              {/* Project bar */}
              {projBarVisible && (
                <div
                  className="absolute rounded-md cursor-pointer hover:brightness-95 transition-all"
                  style={{
                    left: projLeft,
                    width: Math.max(projWidth, 4),
                    top: 8,
                    height: ROW_H - 16,
                    backgroundColor: color + "33",
                    border: `1.5px solid ${color}88`,
                  }}
                  onClick={() => router.push(`/admin/projects/${project.id}`)}
                  title={project.name}
                />
              )}

              {/* Add milestone button */}
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMilestoneDialog({ open: true, projectId: project.id, milestone: null });
                }}
                title="Meilenstein hinzufügen"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {/* Project milestone diamonds */}
              {project.milestones.filter((m) => m.dueAt).map((m) => {
                const left = barLeft(m.dueAt!, viewStart, pxD);
                if (left < 7) return null;
                return (
                  <div
                    key={m.id}
                    className="absolute cursor-pointer hover:scale-125 transition-transform z-10"
                    style={{
                      left: left - 7,
                      top: ROW_H / 2 - 7,
                      width: 14,
                      height: 14,
                      backgroundColor: m.color,
                      transform: "rotate(45deg)",
                      opacity: m.completedAt ? 0.5 : 1,
                    }}
                    title={m.name + (m.dueAt ? ` — ${new Date(m.dueAt).toLocaleDateString("de-DE")}` : "")}
                    onClick={(e) => {
                      e.stopPropagation();
                      const pm: PlanningMilestone = {
                        id: m.id,
                        orderId: null,
                        projectId: project.id,
                        name: m.name,
                        description: null,
                        dueAt: m.dueAt,
                        completedAt: m.completedAt,
                        color: m.color,
                        position: m.position,
                        tasks: [],
                      };
                      setMilestoneDialog({ open: true, projectId: project.id, milestone: pm });
                    }}
                  />
                );
              })}
            </div>

            {/* Order lane rows */}
            {!isCollapsed && project.orders.length > 0 &&
              Array.from({ length: maxLane + 1 }, (_, laneIdx) => {
                const laneOrders = byLane.get(laneIdx) ?? [];
                return (
                  <div
                    key={laneIdx}
                    className="relative border-b hover:bg-muted/10 group"
                    style={{ height: LANE_ROW_H, minWidth: "100%", borderLeft: `3px solid ${color}33` }}
                  >
                    <GanttGridLines />
                    <GanttTodayLine />

                    {laneOrders.map((order) => {
                      const startDate = order.createdAt;
                      const endDate = order.deadline;
                      const isOpen = !endDate;
                      const rawLeft = barLeft(startDate, viewStart, pxD);
                      const rawWidth = endDate ? barWidth(startDate, endDate, pxD) : OPEN_BAR_DAYS * pxD;
                      const clampedLeft = Math.max(0, rawLeft);
                      const width = rawWidth - (clampedLeft - rawLeft);
                      const barVisible = clampedLeft + width > 0;
                      const phaseColor = order.phase.color;
                      const tooltip = `${order.customerName} — ${order.phase.name}${endDate ? `\n${new Date(endDate).toLocaleDateString("de-DE")}` : "\nKein Termin"}`;

                      return (
                        <div key={order.id}>
                          {barVisible && (
                            <div
                              className={cn(
                                "absolute rounded-md shadow-sm cursor-pointer select-none hover:brightness-95 transition-all",
                                isOpen ? "border-dashed border-2" : ""
                              )}
                              style={{
                                left: clampedLeft,
                                width: Math.max(width, 4),
                                top: 5,
                                height: LANE_ROW_H - 10,
                                backgroundColor: phaseColor + "33",
                                borderColor: phaseColor,
                                borderWidth: isOpen ? undefined : 1,
                                borderStyle: isOpen ? undefined : "solid",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (orderDraggedRef.current) { orderDraggedRef.current = false; return; }
                                router.push(`/admin/orders/${order.id}`);
                              }}
                              title={tooltip}
                            >
                              {width > 80 && (
                                <div className="h-full px-2 flex items-center text-xs font-medium truncate" style={{ color: phaseColor }}>
                                  {order.customerName}
                                </div>
                              )}
                              <div
                                className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px opacity-0 hover:opacity-100 transition-opacity rounded-r-md"
                                style={{ backgroundColor: phaseColor + "44" }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  startOrderResize(order.id, e.clientX, order.deadline, viewStart);
                                }}
                              >
                                <div className="w-px h-3 rounded-full" style={{ backgroundColor: phaseColor }} />
                                <div className="w-px h-3 rounded-full" style={{ backgroundColor: phaseColor }} />
                              </div>
                            </div>
                          )}

                          {/* Milestone diamonds */}
                          {order.milestones.filter((m) => m.dueAt).map((m) => {
                            const left = barLeft(m.dueAt!, viewStart, pxD);
                            if (left < 7) return null;
                            return (
                              <div
                                key={m.id}
                                className="absolute cursor-pointer hover:scale-125 transition-transform z-10"
                                style={{
                                  left: left - 7,
                                  top: LANE_ROW_H / 2 - 7,
                                  width: 14,
                                  height: 14,
                                  backgroundColor: m.color,
                                  transform: "rotate(45deg)",
                                  opacity: m.completedAt ? 0.5 : 1,
                                }}
                                title={m.name + (m.dueAt ? ` — ${new Date(m.dueAt).toLocaleDateString("de-DE")}` : "")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMilestoneDialog({
                                    open: true,
                                    orderId: order.id,
                                    milestone: { ...m, orderId: order.id, description: null, tasks: [] },
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        );
      })}

      {projects.length === 0 && (
        <div
          className="relative border-b flex items-center justify-center text-[11px] text-muted-foreground"
          style={{ height: LANE_ROW_H, minWidth: "100%" }}
        >
          <GanttGridLines />
          Keine Projekte
        </div>
      )}

      <MilestoneDialog
        key={
          editingMilestone?.id ??
          (milestoneDialog.projectId ? `proj-${milestoneDialog.projectId}` : milestoneDialog.orderId) ??
          "new"
        }
        open={milestoneDialog.open}
        onOpenChange={(v) => setMilestoneDialog((s) => ({ ...s, open: v }))}
        orderId={milestoneDialog.orderId}
        projectId={milestoneDialog.projectId}
        milestone={editingMilestone}
        users={users}
        onSaved={handleMilestoneSaved}
        onDeleted={handleMilestoneDeleted}
        minDate={
          milestoneDialog.projectId
            ? projects.find((p) => p.id === milestoneDialog.projectId)?.createdAt
            : allOrders.find((o) => o.id === milestoneDialog.orderId)?.createdAt
        }
        maxDate={
          milestoneDialog.projectId
            ? projects.find((p) => p.id === milestoneDialog.projectId)?.deadline
            : allOrders.find((o) => o.id === milestoneDialog.orderId)?.deadline
        }
      />
    </>
  );
}

export function ProjectGantt({ initialProjects, users }: ProjectGanttProps) {
  const [projects, setProjects] = useState(initialProjects);

  return (
    <GanttShell>
      <ProjectGanttRows projects={projects} onProjectsChange={setProjects} users={users} />
    </GanttShell>
  );
}
