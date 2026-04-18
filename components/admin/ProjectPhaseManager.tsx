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
import { GripVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";

export interface ProjectPhaseData {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  _count: { projects: number };
}

function SortablePhaseRow({
  phase,
  onEdit,
  onDelete,
}: {
  phase: ProjectPhaseData;
  onEdit: (phase: ProjectPhaseData) => void;
  onDelete: (phase: ProjectPhaseData) => void;
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

      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
        {phase._count.projects} Projekte
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
          disabled={phase._count.projects > 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface ProjectPhaseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhases: ProjectPhaseData[];
  onPhasesChange?: (phases: ProjectPhaseData[]) => void;
}

export function ProjectPhaseManager({
  open,
  onOpenChange,
  initialPhases,
  onPhasesChange,
}: ProjectPhaseManagerProps) {
  const [phases, setPhases] = useState(initialPhases);
  const [editingPhase, setEditingPhase] = useState<ProjectPhaseData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#6366f1", isDefault: false });
  const [saving, setSaving] = useState(false);

  // Refresh phases from API when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/project-phases")
      .then((r) => r.json())
      .then((fresh) => setPhases(fresh))
      .catch(() => {});
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function openCreate() {
    setFormData({ name: "", color: "#6366f1", isDefault: false });
    setEditingPhase(null);
    setIsEditing(true);
  }

  function openEdit(phase: ProjectPhaseData) {
    setFormData({ name: phase.name, color: phase.color, isDefault: phase.isDefault });
    setEditingPhase(phase);
    setIsEditing(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      if (editingPhase) {
        const res = await fetch(`/api/admin/project-phases/${editingPhase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        const newPhases = phases.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
        setPhases(newPhases);
        onPhasesChange?.(newPhases);
        toast.success("Phase aktualisiert");
      } else {
        const res = await fetch("/api/admin/project-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        const newPhases = [...phases, { ...created, _count: { projects: 0 } }];
        setPhases(newPhases);
        onPhasesChange?.(newPhases);
        toast.success("Phase erstellt");
      }
      setIsEditing(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(phase: ProjectPhaseData) {
    if (!confirm(`Phase "${phase.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/project-phases/${phase.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      const newPhases = phases.filter((p) => p.id !== phase.id);
      setPhases(newPhases);
      onPhasesChange?.(newPhases);
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
    onPhasesChange?.(reordered);

    try {
      await Promise.all(
        reordered.map((phase) =>
          fetch(`/api/admin/project-phases/${phase.id}`, {
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Projektphasen verwalten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Konfiguriere die Phasen für den Projekt-Workflow
              </p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Phase
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
              <div className="text-center py-8 text-muted-foreground text-sm">
                Noch keine Projektphasen konfiguriert
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Phase bearbeiten" : "Neue Phase"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-phase-name">Name *</Label>
              <Input
                id="proj-phase-name"
                placeholder="z.B. In Umsetzung"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-phase-color">Farbe</Label>
              <div className="flex items-center gap-3">
                <input
                  id="proj-phase-color"
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
                id="proj-phase-default"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="proj-phase-default">Als Standard-Phase (für neue Projekte)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
