"use client";

import { useState } from "react";
import Link from "next/link";
import { Kanban, GanttChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./KanbanBoard";
import { ArchiveList } from "./ArchiveList";
import { OrderGantt } from "./OrderGantt";

interface OrderPhase {
  id: string;
  name: string;
  color: string;
  position: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOrder = any;

interface DashboardViewProps {
  phases: OrderPhase[];
  orders: AnyOrder[];
  archiveCount: number;
  showArchived: boolean;
  isAdmin: boolean;
  searchQuery?: string;
  filterKey: string;
  users: { id: string; name: string; email: string }[];
}

type ViewMode = "kanban" | "gantt";

const tabBase = "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors";
const tabActive = `${tabBase} border-primary text-foreground`;
const tabInactive = `${tabBase} border-transparent text-muted-foreground hover:text-foreground hover:border-border`;

export function DashboardView({
  phases,
  orders,
  archiveCount,
  showArchived,
  isAdmin,
  searchQuery,
  filterKey,
  users,
}: DashboardViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  return (
    <>
      <nav className="flex border-b border-border -mt-2 flex-shrink-0 items-center">
        <Link href="/admin/orders" className={showArchived ? tabInactive : tabActive}>
          Aufträge
        </Link>
        <Link href="/admin/orders?tab=archiv" className={showArchived ? tabActive : tabInactive}>
          Archiv ({archiveCount})
        </Link>
        {!showArchived && (
          <>
            <div className="w-px h-5 bg-border mx-2" />
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1.5 text-xs", viewMode === "kanban" && "bg-muted")}
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 gap-1.5 text-xs", viewMode === "gantt" && "bg-muted")}
                onClick={() => setViewMode("gantt")}
              >
                <GanttChart className="h-3.5 w-3.5" />
                Gantt
              </Button>
            </div>
          </>
        )}
      </nav>

      {showArchived ? (
        <ArchiveList orders={orders} isAdmin={isAdmin} />
      ) : viewMode === "kanban" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard
            key={filterKey}
            phases={phases}
            initialOrders={orders}
            searchQuery={searchQuery}
            archiveCount={archiveCount}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <OrderGantt initialOrders={orders} users={users} />
        </div>
      )}
    </>
  );
}
