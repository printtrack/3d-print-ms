"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { JobCard, type PrintJob } from "./JobCard";
import { cn } from "@/lib/utils";
import { Cpu } from "lucide-react";

interface JobQueueColumnProps {
  machine: { id: string; name: string; buildVolumeX: number; buildVolumeY: number; buildVolumeZ: number };
  jobs: PrintJob[];
  onJobClick: (job: PrintJob) => void;
  onCreateJob: (machineId: string) => void;
}

export function JobQueueColumn({ machine, jobs, onJobClick, onCreateJob }: JobQueueColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: machine.id,
    data: { type: "machine", machineId: machine.id },
  });

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{machine.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {jobs.length}
          </span>
          <button
            onClick={() => onCreateJob(machine.id)}
            className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            + Job
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground px-1 mb-3">
        {machine.buildVolumeX} × {machine.buildVolumeY} × {machine.buildVolumeZ} mm
      </p>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[200px] rounded-lg p-2 space-y-2 overflow-y-auto transition-colors",
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        )}
      >
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={onJobClick} />
          ))}
        </SortableContext>

        {jobs.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Keine Jobs
          </div>
        )}
      </div>
    </div>
  );
}
