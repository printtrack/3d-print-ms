"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface JobOption {
  id: string;
  machine: { name: string };
  status: string;
  plannedAt: string | null;
}

interface PartLinkJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partId: string;
  partName: string;
  /** ID of the active job this part is already linked to (PLANNED/SLICED/IN_PROGRESS) */
  activeJobId?: string | null;
  onLinked?: () => void;
}

export function PartLinkJobDialog({
  open,
  onOpenChange,
  partId,
  partName,
  activeJobId = null,
  onLinked,
}: PartLinkJobDialogProps) {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedJobId("");
    setLoading(true);
    fetch("/api/admin/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: JobOption[]) => {
        setJobs(data.filter((j) => j.status !== "DONE" && j.status !== "CANCELLED" && j.id !== activeJobId));
      })
      .catch(() => toast.error("Jobs konnten nicht geladen werden"))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleLink() {
    if (!selectedJobId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/jobs/${selectedJobId}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderPartId: partId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Fehler beim Hinzufügen");
      }
      toast.success(`Teil "${partName}" zum Job hinzugefügt`);
      onLinked?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hinzufügen");
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zu Druckjob hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Aktiver Job</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine aktiven Jobs vorhanden.</p>
          ) : (
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Job wählen..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.machine.name}
                      {j.plannedAt ? ` · ${new Date(j.plannedAt).toLocaleDateString("de")}` : ""}
                      {" "}
                      [{j.status}]
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            Abbrechen
          </Button>
          <Button onClick={handleLink} disabled={!selectedJobId || linking}>
            {linking ? "..." : "Hinzufügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
