"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Cpu, Pencil, Plus, Trash2 } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  hourlyRate: number | null;
  notes: string | null;
  isActive: boolean;
  _count: { printJobs: number };
}

type FormData = {
  name: string;
  buildVolumeX: string;
  buildVolumeY: string;
  buildVolumeZ: string;
  hourlyRate: string;
  notes: string;
  isActive: boolean;
};

export function MachineManager({ initialMachines }: { initialMachines: Machine[] }) {
  const [machines, setMachines] = useState(initialMachines);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    buildVolumeX: "",
    buildVolumeY: "",
    buildVolumeZ: "",
    hourlyRate: "",
    notes: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/machines")
      .then((r) => r.json())
      .then((fresh) => setMachines(fresh))
      .catch(() => {});
  }, []);

  function openCreate() {
    setFormData({ name: "", buildVolumeX: "", buildVolumeY: "", buildVolumeZ: "", hourlyRate: "", notes: "", isActive: true });
    setEditingMachine(null);
    setIsDialogOpen(true);
  }

  function openEdit(machine: Machine) {
    setFormData({
      name: machine.name,
      buildVolumeX: String(machine.buildVolumeX),
      buildVolumeY: String(machine.buildVolumeY),
      buildVolumeZ: String(machine.buildVolumeZ),
      hourlyRate: machine.hourlyRate != null ? String(machine.hourlyRate) : "",
      notes: machine.notes ?? "",
      isActive: machine.isActive,
    });
    setEditingMachine(machine);
    setIsDialogOpen(true);
  }

  function field(key: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!formData.name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (!formData.buildVolumeX || !formData.buildVolumeY || !formData.buildVolumeZ) {
      toast.error("Bauvolumen ist erforderlich");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      buildVolumeX: parseInt(formData.buildVolumeX, 10),
      buildVolumeY: parseInt(formData.buildVolumeY, 10),
      buildVolumeZ: parseInt(formData.buildVolumeZ, 10),
      hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
      notes: formData.notes.trim() || null,
      isActive: formData.isActive,
    };

    setSaving(true);
    try {
      if (editingMachine) {
        const res = await fetch(`/api/admin/machines/${editingMachine.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setMachines((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        toast.success("Maschine aktualisiert");
      } else {
        const res = await fetch("/api/admin/machines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setMachines((prev) => [...prev, { ...created, _count: { printJobs: 0 } }]);
        toast.success("Maschine erstellt");
      }
      setIsDialogOpen(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(machine: Machine) {
    if (!confirm(`Maschine "${machine.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/machines/${machine.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      setMachines((prev) => prev.filter((m) => m.id !== machine.id));
      toast.success("Maschine gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maschinen</h1>
          <p className="text-muted-foreground text-sm">
            Verwalte deine 3D-Drucker und deren Spezifikationen
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Maschine hinzufügen
        </Button>
      </div>

      <div className="space-y-2">
        {machines.map((machine) => (
          <div
            key={machine.id}
            className="flex items-center gap-3 p-3 bg-card border rounded-lg"
            data-testid="machine-row"
          >
            <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{machine.name}</span>
                {!machine.isActive && (
                  <Badge variant="secondary" className="text-xs">Inaktiv</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {machine.buildVolumeX} × {machine.buildVolumeY} × {machine.buildVolumeZ} mm
                {machine.hourlyRate != null && ` · ${Number(machine.hourlyRate).toFixed(2)} €/h`}
              </p>
            </div>

            <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
              {machine._count.printJobs} Jobs
            </span>

            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(machine)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(machine)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {machines.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Noch keine Maschinen konfiguriert
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Maschine bearbeiten" : "Neue Maschine"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="machine-name">Name *</Label>
              <Input
                id="machine-name"
                placeholder="z.B. Prusa MK4"
                value={formData.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Bauvolumen (mm) *</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input
                    type="number"
                    placeholder="X"
                    value={formData.buildVolumeX}
                    onChange={(e) => field("buildVolumeX", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Breite</p>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Y"
                    value={formData.buildVolumeY}
                    onChange={(e) => field("buildVolumeY", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Tiefe</p>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Z"
                    value={formData.buildVolumeZ}
                    onChange={(e) => field("buildVolumeZ", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Höhe</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="machine-rate">Stundensatz (€/h)</Label>
              <Input
                id="machine-rate"
                type="number"
                step="0.01"
                placeholder="z.B. 2.50"
                value={formData.hourlyRate}
                onChange={(e) => field("hourlyRate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="machine-notes">Notizen</Label>
              <Textarea
                id="machine-notes"
                placeholder="Besonderheiten, Kalibrierungshinweise..."
                value={formData.notes}
                onChange={(e) => field("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="machine-active"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => field("isActive", e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="machine-active">Aktiv (für neue Jobs verfügbar)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
