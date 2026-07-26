"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrintJob } from "./JobCard";

interface FilamentChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Jobs with a pending swap, in print order. */
  jobs: PrintJob[];
  onConfirmed: () => void;
}

/**
 * One list of everything the operator has to swap, grouped by printer — the
 * shop-floor view: walk to the machines once and tick them off.
 */
export function FilamentChangesDialog({ open, onOpenChange, jobs, onConfirmed }: FilamentChangesDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function confirm(jobId: string) {
    setBusyId(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/filament-change`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success(t("filament_change_confirmed"));
      onConfirmed();
    } catch {
      toast.error(t("filament_change_failed"));
    } finally {
      setBusyId(null);
    }
  }

  const byMachine = new Map<string, PrintJob[]>();
  for (const job of jobs) {
    const list = byMachine.get(job.machine.name) ?? [];
    list.push(job);
    byMachine.set(job.machine.name, list);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {t("filament_changes_title")}
          </DialogTitle>
          <DialogDescription>{t("filament_changes_description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("filament_changes_empty")}</p>
          ) : (
            [...byMachine.entries()].map(([machineName, machineJobs]) => (
              <div key={machineName} className="space-y-2">
                <p className="text-sm font-medium">{machineName}</p>
                <div className="rounded-lg border divide-y" data-testid="filament-change-list">
                  {machineJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {job.filamentChange!.unload.length > 0 && (
                            <span className="text-muted-foreground line-through">
                              {job.filamentChange!.unload.join(", ")}
                            </span>
                          )}
                          {job.filamentChange!.unload.length > 0 && <span className="mx-1.5">→</span>}
                          <span className="font-medium">{job.filamentChange!.load.join(", ")}</span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job.shortCode ?? job.id.slice(-6)}
                          {job.plannedAt
                            ? ` · ${new Date(job.plannedAt).toLocaleString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : ` · ${t("filament_changes_unscheduled")}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={busyId === job.id}
                        onClick={() => confirm(job.id)}
                      >
                        {busyId === job.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          t("filament_change_done")
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
