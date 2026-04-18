"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PrintJobFile {
  id: string;
  printJobId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface PrintJob {
  id: string;
  machineId: string;
  status: "PLANNED" | "SLICED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  queuePosition: number;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  printTimeMinutes: number | null;
  printTimeFromGcode: boolean;
  notes: string | null;
  machine: { id: string; name: string };
  parts: Array<{
    printJobId: string;
    orderPartId: string;
    addedAt: string;
    orderPart: {
      id: string;
      orderId: string;
      name: string;
      filamentId: string | null;
      quantity: number;
      order: { id: string; customerName: string; customerEmail: string; description: string };
      filament: { id: string; name: string; material: string; color: string; colorHex: string | null } | null;
    };
  }>;
  filamentUsages: Array<{
    id: string;
    gramsActual: number;
    filament: { id: string; name: string; material: string; color: string; colorHex: string | null };
  }>;
  files?: PrintJobFile[];
}

const STATUS_LABELS: Record<PrintJob["status"], string> = {
  PLANNED: "Geplant",
  SLICED: "Gesliced",
  IN_PROGRESS: "Im Druck",
  DONE: "Abgeschlossen",
  CANCELLED: "Storniert",
};

const STATUS_COLORS: Record<PrintJob["status"], string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  SLICED: "bg-purple-100 text-purple-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function JobCard({
  job,
  onClick,
}: {
  job: PrintJob;
  onClick: (job: PrintJob) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { type: "job", job },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Unique customer names from parts
  const uniqueCustomerNames = [...new Map(
    job.parts.map((p) => [p.orderPart.orderId, p.orderPart.order.customerName])
  ).values()];

  return (
    <div ref={setNodeRef} style={style} className="bg-card border rounded-lg p-3 shadow-sm space-y-2">
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onClick(job)}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", STATUS_COLORS[job.status])}>
              {STATUS_LABELS[job.status]}
            </span>
            {job.plannedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(job.plannedAt).toLocaleDateString("de-DE")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3 w-3 shrink-0" />
            <span>{job.parts.length} Teile</span>
          </div>

          {uniqueCustomerNames.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {uniqueCustomerNames.slice(0, 3).map((name, i) => (
                <p key={i} className="text-xs truncate text-foreground/70">
                  {name}
                </p>
              ))}
              {uniqueCustomerNames.length > 3 && (
                <p className="text-xs text-muted-foreground">+{uniqueCustomerNames.length - 3} weitere</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
