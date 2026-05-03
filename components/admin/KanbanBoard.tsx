"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  TouchSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Archive } from "lucide-react";
import { useLiveEvents } from "@/lib/use-live-events";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  deadline: string | null;
  phase: { id: string; name: string; color: string };
  assignees: Array<{ id: string; name: string; email: string }>;
  files: Array<{ id: string; filename: string; mimeType: string }>;
  _count: { comments: number };
  priceEstimate: number | null;
  phaseId: string;
  phaseOrder: number | null;
  pendingVerification: boolean;
  isPrototype: boolean;
  iterationCount: number;
  project?: { id: string; name: string } | null;
}

interface Phase {
  id: string;
  name: string;
  color: string;
  position: number;
  isPrototype?: boolean;
}

interface KanbanBoardProps {
  phases: Phase[];
  initialOrders: Order[];
  searchQuery?: string;
  archiveCount?: number;
}

function ArchiveDropZone({ archiveCount, isDragging }: { archiveCount: number; isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "archive", data: { type: "archive" } });

  return (
    <div
      className={cn(
        "flex flex-col w-[280px] flex-shrink-0 h-full transition-opacity duration-200",
        isDragging ? "opacity-100" : "opacity-30"
      )}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Archive className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground">Archiv</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {archiveCount}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-150",
          isOver
            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
            : isDragging
            ? "border-amber-300/60 bg-muted/20"
            : "border-border bg-muted/30"
        )}
      >
        <Archive
          className={cn(
            "w-8 h-8 transition-colors",
            isOver ? "text-amber-500" : "text-muted-foreground/50"
          )}
        />
        <p
          className={cn(
            "text-xs text-center px-4 transition-colors",
            isOver ? "text-amber-600 font-medium" : "text-muted-foreground/70"
          )}
        >
          {isOver ? "Loslassen zum Archivieren" : "Hierher ziehen zum Archivieren"}
        </p>
      </div>
    </div>
  );
}

export function KanbanBoard({ phases, initialOrders, searchQuery, archiveCount = 0 }: KanbanBoardProps) {
  const prototypePhasesIds = phases.filter((p) => p.isPrototype).map((p) => p.id);
  const [orders, setOrders] = useState<Order[]>(
    initialOrders.map((o) => ({ ...o, phaseId: o.phase.id }))
  );
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>(() =>
    phases.reduce(
      (acc, p) => ({
        ...acc,
        [p.id]: initialOrders.filter((o) => o.phase.id === p.id).map((o) => o.id),
      }),
      {} as Record<string, string[]>
    )
  );
  const columnOrdersRef = useRef(columnOrders);
  const savedColumnOrders = useRef<Record<string, string[]>>({});

  useEffect(() => {
    columnOrdersRef.current = columnOrders;
  }, [columnOrders]);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(isDragging);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const router = useRouter();

  // Sync initialOrders into local state when props change (triggered by router.refresh())
  // but never interrupt an active drag.
  useEffect(() => {
    if (isDraggingRef.current) return;
    setOrders(initialOrders.map((o) => ({ ...o, phaseId: o.phase.id })));
    setColumnOrders(
      phases.reduce(
        (acc, p) => ({
          ...acc,
          [p.id]: initialOrders.filter((o) => o.phase.id === p.id).map((o) => o.id),
        }),
        {} as Record<string, string[]>
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrders]);

  useLiveEvents(
    useCallback(
      (event) => {
        if (event.type === "order.changed" && !isDraggingRef.current) {
          router.refresh();
        }
      },
      [router]
    )
  );

  async function handleMobileMove(orderId: string, newPhaseId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.phaseId === newPhaseId) return;

    if (newPhaseId !== "__archive__" && order.pendingVerification) {
      const currentPhase = phases.find((p) => p.id === order.phaseId);
      const targetPhase = phases.find((p) => p.id === newPhaseId);
      if (currentPhase && targetPhase && targetPhase.position > currentPhase.position) {
        toast.error("Freigabe ausstehend – Auftrag kann nicht vorwärts verschoben werden");
        return;
      }
    }

    if (newPhaseId === "__archive__") {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      try {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archive: true }),
        });
        if (!res.ok) throw new Error();
        toast.success(`"${order.customerName}" archiviert`);
      } catch {
        toast.error("Archivieren fehlgeschlagen");
        setOrders((prev) => [...prev, order]);
      }
      return;
    }

    const newPhase = phases.find((p) => p.id === newPhaseId)!;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, phaseId: newPhaseId, phase: newPhase } : o
      )
    );

    const currentPhase = phases.find((p) => p.id === order.phaseId);
    const isBackwardMove = currentPhase && newPhase.position < currentPhase.position;
    const bothInPrototype =
      prototypePhasesIds.includes(order.phaseId) && prototypePhasesIds.includes(newPhaseId);

    let patchPayload: Record<string, unknown> = { phaseId: newPhaseId };
    if (isBackwardMove && bothInPrototype && order.isPrototype) {
      patchPayload = { phaseId: newPhaseId, iterationCount: order.iterationCount + 1 };
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, iterationCount: order.iterationCount + 1 } : o))
      );
    }

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });
      if (!res.ok) throw new Error();
      toast.success(`"${order.customerName}" → ${newPhase.name}`);
      setActiveTab(phases.findIndex((p) => p.id === newPhaseId));
    } catch {
      toast.error("Phasenänderung fehlgeschlagen");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, phaseId: order.phaseId, phase: order.phase } : o
        )
      );
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function getOrdersForPhase(phaseId: string) {
    return (columnOrders[phaseId] ?? [])
      .map((id) => orders.find((o) => o.id === id))
      .filter((o): o is Order => Boolean(o));
  }

  function handleDragStart(event: DragStartEvent) {
    const order = orders.find((o) => o.id === event.active.id);
    setActiveOrder(order ?? null);
    setIsDragging(true);
    savedColumnOrders.current = { ...columnOrdersRef.current };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== "order") return;

    // Determine target phase from the over element
    const targetPhaseId =
      overData?.type === "column"
        ? (overData.phaseId as string)
        : overData?.type === "order"
        ? orders.find((o) => o.id === over.id)?.phaseId ?? null
        : null;

    if (!targetPhaseId) return;

    const activeItem = orders.find((o) => o.id === active.id);
    if (!activeItem) return;

    const activePhaseId = activeItem.phaseId;

    if (activePhaseId === targetPhaseId) {
      // Same-column reorder — visual only, no API call yet
      if (overData?.type !== "order") return;
      setColumnOrders((prev) => {
        const col = prev[targetPhaseId] ?? [];
        const oldIdx = col.indexOf(active.id as string);
        const newIdx = col.indexOf(over.id as string);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
        return { ...prev, [targetPhaseId]: arrayMove(col, oldIdx, newIdx) };
      });
    } else {
      // Cross-column move
      setOrders((prev) => {
        const item = prev.find((o) => o.id === active.id);
        if (!item || item.phaseId === targetPhaseId) return prev;
        return prev.map((o) =>
          o.id === active.id
            ? { ...o, phaseId: targetPhaseId, phase: phases.find((p) => p.id === targetPhaseId)! }
            : o
        );
      });

      setColumnOrders((prev) => {
        const sourceCol = (prev[activePhaseId] ?? []).filter((id) => id !== active.id);
        const targetCol = prev[targetPhaseId] ?? [];

        // Already in target column — no change needed
        if (targetCol.includes(active.id as string)) return prev;

        // Insert at the position of the over card, or at end if over a column background
        let insertIdx = targetCol.length;
        if (overData?.type === "order") {
          const overIdx = targetCol.indexOf(over.id as string);
          if (overIdx !== -1) insertIdx = overIdx;
        }

        const newTargetCol = [
          ...targetCol.slice(0, insertIdx),
          active.id as string,
          ...targetCol.slice(insertIdx),
        ];

        return {
          ...prev,
          [activePhaseId]: sourceCol,
          [targetPhaseId]: newTargetCol,
        };
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOrder(null);
    setIsDragging(false);

    if (!over) {
      // Drag cancelled — restore pre-drag order
      setColumnOrders(savedColumnOrders.current);
      return;
    }

    // Archive drop zone
    if (over.id === "archive") {
      const order = orders.find((o) => o.id === active.id);
      if (!order) return;
      setOrders((prev) => prev.filter((o) => o.id !== active.id));
      setColumnOrders((prev) => {
        const col = (prev[order.phaseId] ?? []).filter((id) => id !== active.id);
        return { ...prev, [order.phaseId]: col };
      });
      try {
        const res = await fetch(`/api/admin/orders/${active.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archive: true }),
        });
        if (!res.ok) throw new Error();
        toast.success(`"${order.customerName}" archiviert`);
      } catch {
        toast.error("Archivieren fehlgeschlagen");
        setOrders((prev) => [...prev, order]);
        setColumnOrders(savedColumnOrders.current);
      }
      return;
    }

    const movedOrder = orders.find((o) => o.id === active.id);
    if (!movedOrder) return;

    const originalOrder = initialOrders.find((o) => o.id === active.id);
    const newPhaseId = movedOrder.phaseId;

    // Check pending verification before forward moves
    if (originalOrder && originalOrder.phase.id !== newPhaseId && movedOrder.pendingVerification) {
      const currentPhaseObj = phases.find((p) => p.id === originalOrder.phase.id);
      const targetPhaseObj = phases.find((p) => p.id === newPhaseId);
      if (currentPhaseObj && targetPhaseObj && targetPhaseObj.position > currentPhaseObj.position) {
        toast.error("Freigabe ausstehend – Auftrag kann nicht vorwärts verschoben werden");
        setOrders(initialOrders.map((o) => ({ ...o, phaseId: o.phase.id })));
        setColumnOrders(savedColumnOrders.current);
        return;
      }
    }

    if (originalOrder && originalOrder.phase.id !== newPhaseId) {
      // Cross-column drop: PATCH phase + reorder new column
      const currentPhaseObj = phases.find((p) => p.id === originalOrder.phase.id);
      const targetPhaseObj = phases.find((p) => p.id === newPhaseId);
      const isBackwardMove =
        currentPhaseObj && targetPhaseObj && targetPhaseObj.position < currentPhaseObj.position;
      const bothInPrototype =
        prototypePhasesIds.includes(originalOrder.phase.id) &&
        prototypePhasesIds.includes(newPhaseId);

      let patchPayload: Record<string, unknown> = { phaseId: newPhaseId };
      let newIterationCount: number | undefined;
      if (isBackwardMove && bothInPrototype && movedOrder.isPrototype) {
        newIterationCount = movedOrder.iterationCount + 1;
        patchPayload = { phaseId: newPhaseId, iterationCount: newIterationCount };
        setOrders((prev) =>
          prev.map((o) => (o.id === active.id ? { ...o, iterationCount: newIterationCount! } : o))
        );
      }

      try {
        const res = await fetch(`/api/admin/orders/${active.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        });

        if (!res.ok) {
          if (res.status === 409) {
            const errData = await res.json().catch(() => ({}));
            toast.error(errData.error ?? "Freigabe ausstehend");
          } else {
            toast.error("Phasenänderung fehlgeschlagen");
          }
          setOrders(initialOrders.map((o) => ({ ...o, phaseId: o.phase.id })));
          setColumnOrders(savedColumnOrders.current);
          return;
        }

        const updated = await res.json();
        const newPhase = phases.find((p) => p.id === newPhaseId)!;
        toast.success(`"${movedOrder.customerName}" → ${newPhase.name}`);

        // Update the reference
        const idx = initialOrders.findIndex((o) => o.id === active.id);
        if (idx !== -1) {
          initialOrders[idx] = {
            ...initialOrders[idx],
            phase: updated.phase,
            phaseId: newPhaseId,
            ...(newIterationCount !== undefined ? { iterationCount: newIterationCount } : {}),
          };
        }

        // Persist new column order
        const finalOrder = columnOrdersRef.current[newPhaseId] ?? [];
        if (finalOrder.length > 0) {
          fetch("/api/admin/orders/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phaseId: newPhaseId, orderIds: finalOrder }),
          }).catch(() => {});
        }
      } catch {
        toast.error("Phasenänderung fehlgeschlagen");
        setOrders(initialOrders.map((o) => ({ ...o, phaseId: o.phase.id })));
        setColumnOrders(savedColumnOrders.current);
      }
    } else {
      // Intra-column reorder: persist the new order
      const finalOrder = columnOrdersRef.current[newPhaseId] ?? [];
      if (finalOrder.length > 0) {
        try {
          const res = await fetch("/api/admin/orders/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phaseId: newPhaseId, orderIds: finalOrder }),
          });
          if (!res.ok) throw new Error();
        } catch {
          toast.error("Reihenfolge konnte nicht gespeichert werden");
          setColumnOrders(savedColumnOrders.current);
        }
      }
    }
  }

  const activeOrderForOverlay = activeOrder
    ? { ...activeOrder, phase: phases.find((p) => p.id === activeOrder.phaseId) ?? activeOrder.phase }
    : null;

  return (
    <DndContext
      id="kanban-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Desktop board */}
      <div className="hidden md:flex kanban-board gap-6 overflow-x-scroll overflow-y-hidden pb-6 pt-2 px-1 h-full" data-testid="kanban-board">
        <div className="flex gap-6 h-full min-w-max">
          {phases.map((phase) => (
            <KanbanColumn
              key={phase.id}
              phase={phase}
              orders={getOrdersForPhase(phase.id)}
              searchQuery={searchQuery}
            />
          ))}
          <ArchiveDropZone archiveCount={archiveCount} isDragging={isDragging} />
        </div>
      </div>

      {/* Mobile tab view */}
      <div className="flex flex-col md:hidden h-full">
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 flex-shrink-0">
          {phases.map((phase, index) => (
            <button
              key={phase.id}
              onClick={() => setActiveTab(index)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border flex-shrink-0 transition-colors",
                activeTab === index
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
              {phase.name}
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                {getOrdersForPhase(phase.id).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pt-2 pb-6 space-y-2" data-testid="kanban-mobile-list">
          {phases[activeTab] &&
            getOrdersForPhase(phases[activeTab].id).map((order) => (
              <div key={order.id} className="bg-card border rounded-lg p-3 shadow-sm space-y-2">
                <Link href={`/admin/orders/${order.id}`} className="block">
                  <p className="font-medium text-sm">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  {order.priceEstimate != null && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      {order.priceEstimate.toFixed(2)} €
                    </span>
                  )}
                </Link>
                <select
                  value={order.phaseId}
                  onChange={(e) => handleMobileMove(order.id, e.target.value)}
                  className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-muted-foreground"
                >
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === order.phaseId ? `Phase: ${p.name}` : `→ ${p.name}`}
                    </option>
                  ))}
                  <option value="__archive__">→ Archivieren</option>
                </select>
              </div>
            ))}
          {phases[activeTab] && getOrdersForPhase(phases[activeTab].id).length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Keine Aufträge
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeOrderForOverlay && (
          <div className="rotate-3 scale-105">
            <div className="bg-card border rounded-lg p-3 shadow-xl w-[280px] opacity-90">
              <p className="font-medium text-sm">{activeOrderForOverlay.customerName}</p>
              <p className="text-xs text-muted-foreground">{activeOrderForOverlay.customerEmail}</p>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
