"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, Printer, Star, Trash2 } from "lucide-react";

interface PartPhase {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isPrintReady: boolean;
  _count: { orderParts: number };
}

function SortablePartPhaseRow({
  phase,
  onEdit,
  onDelete,
}: {
  phase: PartPhase;
  onEdit: (phase: PartPhase) => void;
  onDelete: (phase: PartPhase) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg"
      data-testid="part-phase-row"
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />

      <span className="flex-1 min-w-0 font-medium text-sm truncate">{phase.name}</span>

      {phase.isDefault && (
        <Badge variant="secondary" className="text-xs shrink-0">
          <Star className="h-3 w-3 mr-1" />
          Standard
        </Badge>
      )}

      {phase.isPrintReady && (
        <Badge className="text-xs shrink-0 bg-green-100 text-green-700 hover:bg-green-100">
          <Printer className="h-3 w-3 mr-1" />
          Druckbereit
        </Badge>
      )}

      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
        {phase._count.orderParts} Teile
      </span>

      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(phase)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(phase)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function PartPhaseManager({ initialPartPhases }: { initialPartPhases: PartPhase[] }) {
  const [phases, setPhases] = useState(initialPartPhases);
  const [editingPhase, setEditingPhase] = useState<PartPhase | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#6366f1", isDefault: false, isPrintReady: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/part-phases")
      .then((r) => r.json())
      .then((fresh) => setPhases(fresh))
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function openCreate() {
    setFormData({ name: "", color: "#6366f1", isDefault: false, isPrintReady: false });
    setEditingPhase(null);
    setIsCreating(true);
  }

  function openEdit(phase: PartPhase) {
    setFormData({ name: phase.name, color: phase.color, isDefault: phase.isDefault, isPrintReady: phase.isPrintReady });
    setEditingPhase(phase);
    setIsCreating(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      if (editingPhase) {
        const res = await fetch(`/api/admin/part-phases/${editingPhase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setPhases((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        toast.success("Teilphase aktualisiert");
      } else {
        const res = await fetch("/api/admin/part-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setPhases((prev) => [...prev, { ...created, _count: { orderParts: 0 } }]);
        toast.success("Teilphase erstellt");
      }
      setIsCreating(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(phase: PartPhase) {
    if (!confirm(`Teilphase "${phase.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/part-phases/${phase.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Löschen");
        return;
      }
      setPhases((prev) => prev.filter((p) => p.id !== phase.id));
      toast.success("Teilphase gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({ ...p, position: i }));
    setPhases(reordered);

    try {
      await Promise.all(
        reordered.map((phase) =>
          fetch(`/api/admin/part-phases/${phase.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: phase.position }),
          })
        )
      );
    } catch {
      toast.error("Reihenfolge konnte nicht gespeichert werden");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teilphasen</h1>
          <p className="text-muted-foreground text-sm">
            Konfiguriere die Phasen für den Teil-Workflow
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Teilphase hinzufügen
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {phases.map((phase) => (
              <SortablePartPhaseRow
                key={phase.id}
                phase={phase}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {phases.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Noch keine Teilphasen konfiguriert
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Teilphase bearbeiten" : "Neue Teilphase"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="part-phase-name">Name *</Label>
              <Input
                id="part-phase-name"
                placeholder="z.B. Druckbereit"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-phase-color">Farbe</Label>
              <div className="flex items-center gap-3">
                <input
                  id="part-phase-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  placeholder="#6366f1"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="part-is-default"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="part-is-default">Als Standard-Phase (für neue Teile)</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="part-is-print-ready"
                type="checkbox"
                checked={formData.isPrintReady}
                onChange={(e) => setFormData((p) => ({ ...p, isPrintReady: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="part-is-print-ready">Druckbereit (zeigt &quot;Zum Druck&quot; Button)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
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
