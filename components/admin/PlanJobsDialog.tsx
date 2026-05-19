"use client";

import { useState, useEffect } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProposedJob, SkippedPart } from "@/lib/job-planner";
import type { PrintJob } from "./JobCard";

interface PlanJobsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobsCreated: (jobs: PrintJob[]) => void;
}

interface PlanResult {
  proposed: ProposedJob[];
  skipped: SkippedPart[];
}

export function PlanJobsDialog({ open, onOpenChange, onJobsCreated }: PlanJobsDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) fetchPlan();
    else setResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchPlan() {
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/jobs/plan", { method: "POST" });
      if (!res.ok) throw new Error();
      const data: PlanResult = await res.json();
      setResult(data);
      setSelected(new Set(data.proposed.map((_, i) => i)));
    } catch {
      toast.error(t("suggest_jobs_load_failed"));
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
  }

  function toggleJob(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleCommit() {
    if (!result) return;
    const jobs = result.proposed
      .filter((_, i) => selected.has(i))
      .map((j) => {
        const partIds = j.parts.map((p) => p.orderPartId);
        if (j.type === "extend") {
          return { type: "extend" as const, existingJobId: j.existingJobId, partIds };
        }
        return { type: "new" as const, machineId: j.machineId, partIds };
      });

    if (jobs.length === 0) return;

    setCommitting(true);
    try {
      const res = await fetch("/api/admin/jobs/plan/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });
      if (!res.ok) throw new Error();
      const { created } = await res.json();

      // Refetch the created jobs to get full PrintJob objects
      const jobDetails = await Promise.all(
        created.map(async (c: { id: string }) => {
          const r = await fetch(`/api/admin/jobs/${c.id}`);
          return r.ok ? r.json() : null;
        })
      );
      const validJobs = jobDetails.filter(Boolean) as PrintJob[];
      onJobsCreated(validJobs);

      toast.success(
        created.length === 1 ? t("suggest_jobs_created") : t("suggest_jobs_created_plural", { count: created.length })
      );
      onOpenChange(false);
    } catch {
      toast.error(t("suggest_jobs_create_failed"));
    } finally {
      setCommitting(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("suggest_jobs_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("suggest_jobs_loading")}</p>
          )}

          {result && result.proposed.length === 0 && result.skipped.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("suggest_jobs_empty")}
            </p>
          )}

          {result && result.proposed.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t("suggest_jobs_subtitle")} ({result.proposed.length})
              </p>
              {result.proposed.map((job, i) => (
                <label
                  key={i}
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleJob(i)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.type === "extend" ? (
                        <span className="font-medium text-sm text-blue-700">↳ {job.machineName} <span className="text-xs font-normal text-muted-foreground">(bestehender Job)</span></span>
                      ) : (
                        <span className="font-medium text-sm">{job.machineName}</span>
                      )}
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-sm">{job.filamentLabel}</span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground">
                        {job.type === "new" ? `${job.utilizationPct} % Auslastung · ` : ""}
                        {job.type === "new" && job.estimatedGramsTotal !== null ? `~${job.estimatedGramsTotal} g · ` : ""}
                        {job.type === "extend" && job.addedGramsTotal !== null ? `+~${job.addedGramsTotal} g · ` : ""}
                        {`${job.parts.length} ${job.parts.length === 1 ? t("suggest_jobs_part_singular") : t("suggest_jobs_part_plural")}`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {job.parts.map((p) => `${p.partName}${p.quantity > 1 ? ` (×${p.quantity})` : ""}`).join(", ")}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {result && result.skipped.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("suggest_jobs_skipped", { count: result.skipped.length })}
              </p>
              <div className="rounded-lg border divide-y">
                {result.skipped.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="font-medium">{s.partName}</span>
                    <span className="text-muted-foreground">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={committing}>
            {tc("cancel")}
          </Button>
          <Button
            data-tutorial="plan-jobs-confirm"
            onClick={handleCommit}
            disabled={loading || committing || selectedCount === 0}
          >
            {committing
              ? t("suggest_jobs_creating")
              : selectedCount === 0
              ? t("suggest_jobs_no_selection")
              : selectedCount === 1
              ? t("suggest_jobs_create_cta", { count: selectedCount })
              : t("suggest_jobs_create_cta_plural", { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
