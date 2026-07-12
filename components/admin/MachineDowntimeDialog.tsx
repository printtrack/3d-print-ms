"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export interface DowntimeMachine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  isActive: boolean;
  downtimes: {
    id: string;
    startedAt: string;
    endedAt: string | null;
  }[];
}

interface AffectedPart {
  orderPart: {
    id: string;
    name: string;
    bboxXmm: number | null;
    bboxYmm: number | null;
    bboxZmm: number | null;
    order: { id: string };
  };
}

interface AffectedJob {
  id: string;
  shortCode: string | null;
  status: string;
  plannedAt: string | null;
  parts: AffectedPart[];
}

// A part fits a machine if its sorted bbox dims all fit the machine's sorted build volume.
function partFits(
  bbox: { x: number | null; y: number | null; z: number | null },
  m: { buildVolumeX: number; buildVolumeY: number; buildVolumeZ: number }
): boolean {
  if (bbox.x === null || bbox.y === null || bbox.z === null) return true; // unknown → don't block
  const part = [bbox.x, bbox.y, bbox.z].sort((a, b) => a - b);
  const build = [m.buildVolumeX, m.buildVolumeY, m.buildVolumeZ].sort((a, b) => a - b);
  return part.every((d, i) => d <= build[i]);
}

function isMachineDownNow(m: DowntimeMachine): boolean {
  const now = Date.now();
  return m.downtimes.some((d) => {
    const start = new Date(d.startedAt).getTime();
    const end = d.endedAt ? new Date(d.endedAt).getTime() : Infinity;
    return start <= now && end > now;
  });
}

type Choice = "keep" | "backlog" | string; // string = target machineId

export function MachineDowntimeDialog({
  open,
  onOpenChange,
  machine,
  allMachines,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machine: DowntimeMachine | null;
  allMachines: DowntimeMachine[];
  onChanged: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [step, setStep] = useState<"form" | "assistant">("form");
  const [reason, setReason] = useState<"MAINTENANCE" | "DEFECT">("DEFECT");
  const [note, setNote] = useState("");
  const [planned, setPlanned] = useState(false);
  const [plannedStart, setPlannedStart] = useState("");
  const [saving, setSaving] = useState(false);

  const [affectedJobs, setAffectedJobs] = useState<AffectedJob[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  // Reset when the dialog *opens* — not on close. Resetting on close would swap
  // the content back to the form step while Radix is still fading the dialog out,
  // making the outage form flash after "Überspringen"/"Umplanung anwenden".
  useEffect(() => {
    if (open) {
      setStep("form");
      setReason("DEFECT");
      setNote("");
      setPlanned(false);
      setPlannedStart("");
      setAffectedJobs([]);
      setChoices({});
    }
  }, [open]);

  function handleOpenChange(v: boolean) {
    onOpenChange(v);
  }

  async function submitDowntime() {
    if (!machine) return;
    if (planned && !plannedStart) {
      toast.error(t("machine_downtime_start_required"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/machines/${machine.id}/downtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          note: note.trim() || null,
          startedAt: planned ? new Date(plannedStart).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(t("machine_downtime_created"));
      onChanged();

      const jobs: AffectedJob[] = data.affectedJobs ?? [];
      if (!planned && jobs.length > 0) {
        // Immediate outage with jobs to move → open the reschedule assistant.
        setAffectedJobs(jobs);
        const initial: Record<string, Choice> = {};
        jobs.forEach((j) => (initial[j.id] = "backlog"));
        setChoices(initial);
        setStep("assistant");
      } else {
        handleOpenChange(false);
      }
    } catch {
      toast.error(t("machine_downtime_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function applyReschedule() {
    setSaving(true);
    try {
      for (const job of affectedJobs) {
        const choice = choices[job.id];
        if (!choice || choice === "keep") continue;
        const body =
          choice === "backlog"
            ? { plannedAt: null }
            : { machineId: choice };
        await fetch(`/api/admin/jobs/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      toast.success(t("machine_reschedule_done"));
      onChanged();
      handleOpenChange(false);
    } catch {
      toast.error(t("machine_reschedule_failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!machine) return null;

  // Machines eligible as reschedule targets: active, not the down one, not currently down.
  const candidateMachines = allMachines.filter(
    (m) => m.id !== machine.id && m.isActive && !isMachineDownNow(m)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("machine_downtime_dialog_title", { name: machine.name })}</DialogTitle>
              <DialogDescription>{t("machine_downtime_dialog_desc")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("machine_downtime_reason")}</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as "MAINTENANCE" | "DEFECT")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEFECT">{t("machine_reason_defect")}</SelectItem>
                    <SelectItem value="MAINTENANCE">{t("machine_reason_maintenance")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="downtime-planned"
                  type="checkbox"
                  checked={planned}
                  onChange={(e) => setPlanned(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="downtime-planned">{t("machine_downtime_planned")}</Label>
              </div>

              {planned && (
                <div className="space-y-2">
                  <Label htmlFor="downtime-start">{t("machine_downtime_planned_start")}</Label>
                  <Input
                    id="downtime-start"
                    type="datetime-local"
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="downtime-note">{t("machine_downtime_note")}</Label>
                <Textarea
                  id="downtime-note"
                  placeholder={t("machine_downtime_note_placeholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={submitDowntime} disabled={saving}>
                {saving ? `${tc("save")}...` : t("machine_downtime_submit")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("machine_reschedule_title")}</DialogTitle>
              <DialogDescription>{t("machine_reschedule_desc", { name: machine.name })}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
              {affectedJobs.map((job) => {
                const running = job.status === "IN_PROGRESS";
                const fitting = candidateMachines.filter((m) =>
                  job.parts.every((p) =>
                    partFits(
                      { x: p.orderPart.bboxXmm, y: p.orderPart.bboxYmm, z: p.orderPart.bboxZmm },
                      m
                    )
                  )
                );
                return (
                  <div key={job.id} className="border rounded-lg p-3 space-y-2" data-testid="reschedule-job-row">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {job.shortCode ?? job.id.slice(0, 8)}
                        {running && (
                          <span className="ml-2 text-xs text-destructive">
                            {t("machine_reschedule_running")}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {job.parts.length} {t("machine_reschedule_parts")}
                      </span>
                    </div>
                    <Select
                      value={choices[job.id] ?? "backlog"}
                      onValueChange={(v) => setChoices((prev) => ({ ...prev, [job.id]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">{t("machine_reschedule_backlog")}</SelectItem>
                        <SelectItem value="keep">{t("machine_reschedule_keep")}</SelectItem>
                        {fitting.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {t("machine_reschedule_move_to", { name: m.name })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("machine_reschedule_skip")}
              </Button>
              <Button onClick={applyReschedule} disabled={saving}>
                {saving ? `${tc("save")}...` : t("machine_reschedule_apply")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
