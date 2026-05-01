"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kanban, GanttChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobQueueBoard } from "./JobQueueBoard";
import { JobTimeline } from "./JobTimeline";
import type { PrintJob } from "./JobCard";


interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  hourlyRate: number | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface JobsViewProps {
  machines: Machine[];
  initialJobs: PrintJob[];
  teamMembers?: Array<{ id: string; name: string; email: string }>;
}

export function JobsView({ machines, initialJobs, teamMembers = [] }: JobsViewProps) {
  const [view, setView] = useState<"timeline" | "queue">("timeline");
  const [jobs, setJobs] = useState<PrintJob[]>(initialJobs);

  useEffect(() => {
    async function runAutoTransition() {
      try {
        const res = await fetch("/api/admin/jobs/auto-transition", { method: "POST" });
        if (!res.ok) return;
        const { started, completed } = await res.json();
        if (started.length === 0 && completed.length === 0) return;

        const now = new Date().toISOString();
        setJobs((prev) =>
          prev.map((j) => {
            if (completed.includes(j.id)) return { ...j, status: "DONE" as const, completedAt: now };
            if (started.includes(j.id)) return { ...j, status: "IN_PROGRESS" as const, startedAt: now };
            return j;
          })
        );
      } catch {
        // silently ignore network errors
      }
    }

    runAutoTransition();
    const id = setInterval(runAutoTransition, 60_000);
    return () => clearInterval(id);
  }, []);

  function handleJobCreated(job: PrintJob) {
    setJobs((prev) => [...prev, job]);
  }

  function handleJobUpdated(job: PrintJob) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
  }

  function handleJobDeleted(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Druckjobs</h1>
          <p className="text-muted-foreground text-sm">
            {view === "timeline" ? "Gantt-Ansicht" : "Board-Ansicht"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "queue" && "bg-muted")}
            onClick={() => setView("queue")}
          >
            <Kanban className="h-3.5 w-3.5" />
            Board
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1.5 text-xs", view === "timeline" && "bg-muted")}
            onClick={() => setView("timeline")}
          >
            <GanttChart className="h-3.5 w-3.5" />
            Gantt
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {view === "timeline" ? (
          <JobTimeline
            machines={machines}
            jobs={jobs}
            onJobCreated={handleJobCreated}
            onJobUpdated={handleJobUpdated}
            onJobDeleted={handleJobDeleted}
            teamMembers={teamMembers}
          />
        ) : (
          <JobQueueBoard
            machines={machines}
            initialJobs={jobs}
            onJobCreated={handleJobCreated}
            onJobUpdated={handleJobUpdated}
            onJobDeleted={handleJobDeleted}
            teamMembers={teamMembers}
          />
        )}
      </div>
    </div>
  );
}
