"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import type { PrintJob } from "./JobCard";

interface Machine {
  id: string;
  name: string;
}

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: Machine[];
  defaultMachineId?: string;
  defaultDate?: string;
  defaultTime?: string;
  onCreated: (job: PrintJob) => void;
}

export function CreateJobDialog({
  open,
  onOpenChange,
  machines,
  defaultMachineId,
  defaultDate,
  defaultTime,
  onCreated,
}: CreateJobDialogProps) {
  const [machineId, setMachineId] = useState(defaultMachineId ?? "");
  const [plannedDate, setPlannedDate] = useState(defaultDate ?? "");
  const [plannedTime, setPlannedTime] = useState(defaultTime ?? "08:00");
  const [saving, setSaving] = useState(false);

  // Reset form every time the dialog opens so stale state never persists
  useEffect(() => {
    if (!open) return;
    setMachineId(defaultMachineId ?? "");
    setPlannedDate(defaultDate ?? "");
    setPlannedTime(defaultTime ?? "08:00");
  }, [open, defaultMachineId, defaultDate, defaultTime]);

  async function handleCreate() {
    if (!machineId) {
      toast.error("Bitte eine Maschine auswählen");
      return;
    }

    // Build a local-time ISO string only when a date was given
    const plannedAt = plannedDate
      ? new Date(`${plannedDate}T${plannedTime || "00:00"}`).toISOString()
      : null;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, plannedAt }),
      });
      if (!res.ok) throw new Error();
      const job = await res.json();
      onCreated(job);
      toast.success("Druckjob erstellt");
      onOpenChange(false);
    } catch {
      toast.error("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Neuer Druckjob</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Maschine *</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Maschine wählen..." />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Geplanter Starttermin</Label>
            <div className="flex gap-2">
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="flex-1 text-sm border border-input rounded-md px-3 py-2 bg-background"
              />
              <input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                disabled={!plannedDate}
                className="w-28 text-sm border border-input rounded-md px-3 py-2 bg-background disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Erstellen..." : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
