"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kanban, GanttChart, Loader2, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { JobQueueBoard } from "./JobQueueBoard";
import { JobTimeline } from "./JobTimeline";
import { PlanJobsDialog } from "./PlanJobsDialog";
import type { PrintJob } from "./JobCard";
import { useLiveEvents } from "@/lib/use-live-events";


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
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [shortCodeInput, setShortCodeInput] = useState("");
  const [shortCodeSearching, setShortCodeSearching] = useState(false);
  const [openJobTrigger, setOpenJobTrigger] = useState<{ id: string; nonce: number } | null>(null);
  const openNonceRef = useRef(0);
  const router = useRouter();
  const shortCodeInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initialJobs into local state when props change after router.refresh()
  useEffect(() => {
    setJobs(initialJobs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobs]);

  useLiveEvents(
    useCallback(
      (event) => {
        if (event.type === "job.changed") {
          router.refresh();
        }
      },
      [router]
    )
  );

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
            if (completed.includes(j.id)) return { ...j, status: "AWAITING_VERIFICATION" as const, completedAt: now };
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

  function handleJobsCreated(newJobs: PrintJob[]) {
    setJobs((prev) => {
      const result = [...prev];
      for (const job of newJobs) {
        const idx = result.findIndex((j) => j.id === job.id);
        if (idx >= 0) {
          result[idx] = job; // extend: update existing job in place
        } else {
          result.push(job); // new: append
        }
      }
      return result;
    });
  }

  function handleJobUpdated(job: PrintJob) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
  }

  function handleJobDeleted(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  async function handleShortCodeSearch(e: React.FormEvent) {
    e.preventDefault();
    const code = shortCodeInput.trim().toUpperCase();
    if (!code) return;
    setShortCodeSearching(true);
    try {
      // Check local state first — match shortCode or the ID-suffix fallback used by the label
      const local = jobs.find((j) => (j.shortCode ?? j.id.slice(-6)).toUpperCase() === code);
      if (local) {
        setView("queue");
        setOpenJobTrigger({ id: local.id, nonce: ++openNonceRef.current });
        setShortCodeInput("");
        return;
      }
      const res = await fetch(`/api/admin/jobs?shortCode=${encodeURIComponent(code)}`);
      const data = await res.json();
      const job = Array.isArray(data) ? data[0] : null;
      if (!job) {
        toast.error(`Kein Job mit ID „${code}" gefunden`);
        return;
      }
      setView("queue");
      setOpenJobTrigger({ id: job.id, nonce: ++openNonceRef.current });
      setShortCodeInput("");
    } catch {
      toast.error("Fehler bei der Suche");
    } finally {
      setShortCodeSearching(false);
    }
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
        <div className="flex items-center gap-2 flex-wrap">
          <form onSubmit={handleShortCodeSearch} className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={shortCodeInputRef}
                value={shortCodeInput}
                onChange={(e) => setShortCodeInput(e.target.value)}
                placeholder="Job-ID (Etikett)"
                className="pl-8 h-8 w-36 text-xs font-mono"
                maxLength={6}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!shortCodeInput.trim() || shortCodeSearching}
            >
              {shortCodeSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Suchen"}
            </Button>
          </form>
          <Button size="sm" className="gap-1.5" onClick={() => setPlannerOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Druckjobs vorschlagen
          </Button>
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
      </div>

      <PlanJobsDialog
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
        onJobsCreated={handleJobsCreated}
      />

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
            openJobTrigger={openJobTrigger}
          />
        )}
      </div>
    </div>
  );
}
