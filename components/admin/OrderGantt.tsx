"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANE_ROW_H,
  OPEN_BAR_DAYS,
  barLeft,
  barWidth,
  assignLanes,
} from "@/lib/gantt-utils";
import { GanttShell, useGanttContext, GanttGridLines, GanttTodayLine } from "./gantt/GanttShell";
import { useGanttResize } from "./gantt/useGanttResize";
import { MilestoneDialog } from "./MilestoneDialog";
import type { PlanningMilestone } from "./PlanningView";

export interface GanttMilestone {
  id: string;
  name: string;
  dueAt: string | null;
  completedAt: string | null;
  color: string;
  position: number;
}

export interface GanttOrder {
  id: string;
  customerName: string;
  createdAt: string;
  deadline: string | null;
  phase: { id: string; name: string; color: string };
  assignees: { id: string; name: string; email: string }[];
  milestones: GanttMilestone[];
  project?: { id: string; name: string } | null;
  generalProject?: boolean;
}

interface GanttUser {
  id: string;
  name: string;
  email: string;
}

interface OrderGanttProps {
  initialOrders: GanttOrder[];
  users: GanttUser[];
}

function OrderGanttRows({
  orders,
  onOrdersChange,
  users,
}: {
  orders: GanttOrder[];
  onOrdersChange: (orders: GanttOrder[]) => void;
  users: GanttUser[];
}) {
  const router = useRouter();
  const { viewStart, totalWidth, pxD } = useGanttContext();
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean;
    orderId?: string;
    milestone?: PlanningMilestone | null;
  }>({ open: false });

  const patchUrl = useCallback((id: string) => `/api/admin/orders/${id}`, []);
  const { hasDraggedRef, startResize } = useGanttResize(
    orders,
    onOrdersChange,
    pxD,
    patchUrl
  );

  const lanes = assignLanes(orders, viewStart, pxD);
  const maxLane = orders.reduce((m, o) => Math.max(m, lanes.get(o.id) ?? 0), 0);

  const byLane = new Map<number, GanttOrder[]>();
  for (let l = 0; l <= maxLane; l++) byLane.set(l, []);
  for (const order of orders) {
    const lane = lanes.get(order.id) ?? 0;
    byLane.get(lane)!.push(order);
  }

  function handleMilestoneSaved(milestone: PlanningMilestone) {
    onOrdersChange(
      orders.map((o) => {
        if (o.id !== milestoneDialog.orderId) return o;
        const existing = o.milestones.find((m) => m.id === milestone.id);
        if (existing) {
          return { ...o, milestones: o.milestones.map((m) => (m.id === milestone.id ? milestone : m)) };
        }
        return { ...o, milestones: [...o.milestones, milestone] };
      })
    );
  }

  function handleMilestoneDeleted(milestoneId: string) {
    onOrdersChange(
      orders.map((o) => ({
        ...o,
        milestones: o.milestones.filter((m) => m.id !== milestoneId),
      }))
    );
  }

  const editingMilestone = milestoneDialog.milestone as PlanningMilestone | null | undefined;

  return (
    <>
      {Array.from({ length: maxLane + 1 }, (_, laneIdx) => {
        const laneOrders = byLane.get(laneIdx) ?? [];
        return (
          <div key={laneIdx} className="relative border-b hover:bg-muted/10 group" style={{ height: LANE_ROW_H, width: totalWidth, minWidth: "100%" }}>
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
              const barVisible = clampedLeft + width > 0 && clampedLeft < totalWidth;
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
                        top: 6,
                        height: LANE_ROW_H - 12,
                        backgroundColor: phaseColor + "33",
                        borderColor: phaseColor,
                        borderWidth: isOpen ? undefined : 1,
                        borderStyle: isOpen ? undefined : "solid",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasDraggedRef.current) { hasDraggedRef.current = false; return; }
                        router.push(`/admin/orders/${order.id}`);
                      }}
                      title={tooltip}
                    >
                      {width > 80 && (
                        <div className="h-full px-2 flex items-center text-xs font-medium truncate" style={{ color: phaseColor }}>
                          {order.customerName}
                        </div>
                      )}
                      {/* Resize grip */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px opacity-0 hover:opacity-100 transition-opacity rounded-r-md"
                        style={{ backgroundColor: phaseColor + "44" }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(order.id, e.clientX, order.deadline, viewStart);
                        }}
                      >
                        <div className="w-px h-3 rounded-full" style={{ backgroundColor: phaseColor }} />
                        <div className="w-px h-3 rounded-full" style={{ backgroundColor: phaseColor }} />
                      </div>
                    </div>
                  )}

                  {/* Milestone diamonds */}
                  {order.milestones
                    .filter((m) => m.dueAt)
                    .map((m) => {
                      const left = barLeft(m.dueAt!, viewStart, pxD);
                      if (left < 7 || left > totalWidth + 10) return null;
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

                  {/* Add milestone button (show on bar hover) */}
                  {barVisible && (
                    <button
                      type="button"
                      className="absolute opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all z-10"
                      style={{
                        left: Math.max(clampedLeft, 2),
                        top: 2,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMilestoneDialog({ open: true, orderId: order.id, milestone: null });
                      }}
                      title="Meilenstein hinzufügen"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {orders.length === 0 && (
        <div
          className="relative border-b flex items-center justify-center text-[11px] text-muted-foreground"
          style={{ height: LANE_ROW_H, width: totalWidth, minWidth: "100%" }}
        >
          <GanttGridLines />
          Keine Aufträge
        </div>
      )}

      <MilestoneDialog
        key={editingMilestone?.id ?? milestoneDialog.orderId ?? "new"}
        open={milestoneDialog.open}
        onOpenChange={(v) => setMilestoneDialog((s) => ({ ...s, open: v }))}
        orderId={milestoneDialog.orderId}
        milestone={editingMilestone}
        users={users}
        onSaved={handleMilestoneSaved}
        onDeleted={handleMilestoneDeleted}
        minDate={orders.find((o) => o.id === milestoneDialog.orderId)?.createdAt}
        maxDate={orders.find((o) => o.id === milestoneDialog.orderId)?.deadline}
      />
    </>
  );
}

export function OrderGantt({ initialOrders, users }: OrderGanttProps) {
  const [orders, setOrders] = useState(initialOrders);

  return (
    <GanttShell>
      <OrderGanttRows orders={orders} onOrdersChange={setOrders} users={users} />
    </GanttShell>
  );
}
