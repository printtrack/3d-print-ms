"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { JobQueueColumn } from "./JobQueueColumn";
import { JobCard, type PrintJob } from "./JobCard";
import { JobDetailDialog } from "./JobDetailDialog";
import { CreateJobDialog } from "./CreateJobDialog";
import { toast } from "sonner";

interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
}

interface JobQueueBoardProps {
  machines: Machine[];
  initialJobs: PrintJob[];
  onJobCreated?: (job: PrintJob) => void;
  onJobUpdated?: (job: PrintJob) => void;
  onJobDeleted?: (id: string) => void;
}

export function JobQueueBoard({ machines, initialJobs, onJobCreated, onJobUpdated, onJobDeleted }: JobQueueBoardProps) {
  const [jobs, setJobs] = useState<PrintJob[]>(initialJobs);

  // Sync status-only updates pushed down from parent (e.g. auto-transition DONE)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setJobs((prev) =>
      prev.map((j) => {
        const updated = initialJobs.find((ij) => ij.id === j.id);
        return updated && updated.status !== j.status ? { ...j, status: updated.status, completedAt: updated.completedAt, startedAt: updated.startedAt } : j;
      })
    );
  }, [initialJobs]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMachineId, setCreateMachineId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function getJobsForMachine(machineId: string) {
    return jobs
      .filter((j) => j.machineId === machineId)
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id);
    setActiveJob(job ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== "job") return;

    const activeJobItem = activeData.job as PrintJob;

    // Dropping over a machine column
    if (overData?.type === "machine") {
      const targetMachineId = overData.machineId as string;
      if (activeJobItem.machineId !== targetMachineId) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === active.id ? { ...j, machineId: targetMachineId } : j
          )
        );
      }
      return;
    }

    // Dropping over another job
    if (overData?.type === "job") {
      const targetJob = overData.job as PrintJob;
      if (activeJobItem.machineId !== targetJob.machineId) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === active.id ? { ...j, machineId: targetJob.machineId } : j
          )
        );
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const movedJob = jobs.find((j) => j.id === active.id);
    if (!movedJob) return;

    const originalJob = initialJobs.find((j) => j.id === active.id);
    const newMachineId = movedJob.machineId;

    // Reorder within same machine or across machines
    const machineJobs = getJobsForMachine(newMachineId);
    const overJob = jobs.find((j) => j.id === over.id);
    const targetMachineId = overJob?.machineId ?? newMachineId;

    // Build the new ordered list for the target machine
    const targetJobs = jobs
      .filter((j) => j.machineId === targetMachineId)
      .sort((a, b) => a.queuePosition - b.queuePosition);

    const oldIndex = targetJobs.findIndex((j) => j.id === active.id);
    const newIndex = targetJobs.findIndex((j) => j.id === over.id);

    let reordered = targetJobs;
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      reordered = arrayMove(targetJobs, oldIndex, newIndex);
    }

    const updated = reordered.map((j, i) => ({ ...j, queuePosition: i }));
    setJobs((prev) => [
      ...prev.filter((j) => j.machineId !== targetMachineId),
      ...updated,
    ]);

    // Persist: machine change + positions
    try {
      const patches: Promise<Response>[] = [];

      if (originalJob && originalJob.machineId !== newMachineId) {
        patches.push(
          fetch(`/api/admin/jobs/${active.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ machineId: newMachineId, queuePosition: movedJob.queuePosition }),
          })
        );
      }

      // Update queue positions for all jobs in the target column
      for (const j of updated) {
        if (j.id !== active.id || originalJob?.machineId === newMachineId) {
          patches.push(
            fetch(`/api/admin/jobs/${j.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ queuePosition: j.queuePosition }),
            })
          );
        }
      }

      await Promise.all(patches);
    } catch {
      toast.error("Reihenfolge konnte nicht gespeichert werden");
    }
  }

  function handleJobClick(job: PrintJob) {
    setSelectedJob(job);
    setDetailOpen(true);
  }

  function handleCreateJob(machineId: string) {
    setCreateMachineId(machineId);
    setCreateOpen(true);
  }

  function handleJobUpdated(updated: PrintJob) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setSelectedJob(updated);
    onJobUpdated?.(updated);
  }

  function handleJobDeleted(jobId: string) {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setSelectedJob(null);
    onJobDeleted?.(jobId);
  }

  function handleJobCreated(job: PrintJob) {
    setJobs((prev) => [...prev, job]);
    onJobCreated?.(job);
    setSelectedJob(job);
    setDetailOpen(true);
  }

  return (
    <>
      <DndContext
        id="job-queue-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-scroll overflow-y-hidden pb-6 pt-2 px-1 h-full">
          <div className="flex gap-6 h-full min-w-max">
            {machines.map((machine) => (
              <JobQueueColumn
                key={machine.id}
                machine={machine}
                jobs={getJobsForMachine(machine.id)}
                onJobClick={handleJobClick}
                onCreateJob={handleCreateJob}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeJob && (
            <div className="rotate-3 scale-105">
              <div className="bg-card border rounded-lg p-3 shadow-xl w-[280px] opacity-90">
                <p className="text-xs text-muted-foreground">{activeJob.machine.name}</p>
                <p className="text-sm font-medium">{activeJob.parts.length} Teile</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <JobDetailDialog
        job={selectedJob}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleJobUpdated}
        onDeleted={handleJobDeleted}
      />

      <CreateJobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        machines={machines}
        defaultMachineId={createMachineId}
        onCreated={handleJobCreated}
      />
    </>
  );
}
