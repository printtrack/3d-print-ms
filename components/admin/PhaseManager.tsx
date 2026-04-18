"use client";

import { useState, useCallback, useEffect } from "react";
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
  sortableKeyboardCoordinates,
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
import { FlaskConical, GripVertical, MessageSquare, Pencil, Plus, Star, Trash2 } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSurvey: boolean;
  isPrototype: boolean;
  _count: { orders: number };
}

function SortablePhaseRow({
  phase,
  onEdit,
  onDelete,
}: {
  phase: Phase;
  onEdit: (phase: Phase) => void;
  onDelete: (phase: Phase) => void;
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
      data-testid="phase-row"
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: phase.color }}
      />

      <span className="flex-1 min-w-0 font-medium text-sm truncate">{phase.name}</span>

      {phase.isDefault && (
        <Badge variant="secondary" className="text-xs shrink-0">
          <Star className="h-3 w-3 mr-1" />
          Standard
        </Badge>
      )}

      {phase.isSurvey && (
        <Badge variant="secondary" className="text-xs shrink-0">
          <MessageSquare className="h-3 w-3 mr-1" />
          Umfrage
        </Badge>
      )}

      {phase.isPrototype && (
        <Badge className="text-xs shrink-0 bg-purple-100 text-purple-700 hover:bg-purple-100">
          <FlaskConical className="h-3 w-3 mr-1" />
          Prototyp
        </Badge>
      )}

      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">{phase._count.orders} Aufträge</span>

      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(phase)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(phase)}
          disabled={phase._count.orders > 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function PhaseManager({ initialPhases }: { initialPhases: Phase[] }) {
  const [phases, setPhases] = useState(initialPhases);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#6366f1", isDefault: false, isSurvey: false, isPrototype: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/phases")
      .then((r) => r.json())
      .then((fresh) => setPhases(fresh))
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function openCreate() {
    setFormData({ name: "", color: "#6366f1", isDefault: false, isSurvey: false, isPrototype: false });
    setEditingPhase(null);
    setIsCreating(true);
  }

  function openEdit(phase: Phase) {
    setFormData({ name: phase.name, color: phase.color, isDefault: phase.isDefault, isSurvey: phase.isSurvey, isPrototype: phase.isPrototype });
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
        const res = await fetch(`/api/admin/phases/${editingPhase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setPhases((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        toast.success("Phase aktualisiert");
      } else {
        const res = await fetch("/api/admin/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setPhases((prev) => [...prev, { ...created, _count: { orders: 0 } }]);
        toast.success("Phase erstellt");
      }
      setIsCreating(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(phase: Phase) {
    if (!confirm(`Phase "${phase.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/phases/${phase.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      setPhases((prev) => prev.filter((p) => p.id !== phase.id));
      toast.success("Phase gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
      ...p,
      position: i,
    }));

    setPhases(reordered);

    // Persist all positions
    try {
      await Promise.all(
        reordered.map((phase) =>
          fetch(`/api/admin/phases/${phase.id}`, {
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
          <h1 className="text-2xl font-bold tracking-tight">Phasen</h1>
          <p className="text-muted-foreground text-sm">
            Konfiguriere die Phasen für den Auftrags-Workflow
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Phase hinzufügen
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {phases.map((phase) => (
              <SortablePhaseRow
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
          Noch keine Phasen konfiguriert
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Phase bearbeiten" : "Neue Phase"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="phase-name">Name *</Label>
              <Input
                id="phase-name"
                placeholder="z.B. In Bearbeitung"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-color">Farbe</Label>
              <div className="flex items-center gap-3">
                <input
                  id="phase-color"
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
                id="is-default"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="is-default">Als Standard-Phase (für neue Aufträge)</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is-survey"
                type="checkbox"
                checked={formData.isSurvey}
                onChange={(e) => setFormData((p) => ({ ...p, isSurvey: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="is-survey">Umfrageauslöser (sendet Umfrage-E-Mail)</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is-prototype"
                type="checkbox"
                checked={formData.isPrototype}
                onChange={(e) => setFormData((p) => ({ ...p, isPrototype: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="is-prototype">Prototyp-Phase (ermöglicht Iterationszähler bei rückwärtiger Bewegung)</Label>
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
