"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const MILESTONE_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6",
];

interface MilestoneTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  position: number;
}

interface Milestone {
  id: string;
  orderId: string | null;
  projectId?: string | null;
  name: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  color: string;
  position: number;
  tasks: MilestoneTask[];
}

interface User {
  id: string;
  name: string;
}

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass either orderId or projectId */
  orderId?: string | null;
  projectId?: string | null;
  milestone?: Milestone | null;
  users?: User[];
  onSaved: (milestone: Milestone) => void;
  onDeleted?: (milestoneId: string) => void;
  /** ISO date strings for boundary enforcement */
  minDate?: string | null;
  maxDate?: string | null;
}

export function MilestoneDialog({
  open,
  onOpenChange,
  orderId,
  projectId,
  milestone,
  users = [],
  onSaved,
  onDeleted,
  minDate,
  maxDate,
}: MilestoneDialogProps) {
  const isEdit = !!milestone;

  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [dueAt, setDueAt] = useState(
    milestone?.dueAt ? milestone.dueAt.slice(0, 10) : ""
  );
  const [color, setColor] = useState(milestone?.color ?? "#6366f1");
  const [tasks, setTasks] = useState<MilestoneTask[]>(milestone?.tasks ?? []);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const minDateStr = minDate ? minDate.slice(0, 10) : undefined;
  const maxDateStr = maxDate ? maxDate.slice(0, 10) : undefined;
  const dateOutOfRange =
    !!dueAt &&
    ((minDateStr ? dueAt < minDateStr : false) ||
      (maxDateStr ? dueAt > maxDateStr : false));

  // Reset state when dialog opens
  function handleOpenChange(open: boolean) {
    if (!open) {
      setName(milestone?.name ?? "");
      setDescription(milestone?.description ?? "");
      setDueAt(milestone?.dueAt ? milestone.dueAt.slice(0, 10) : "");
      setColor(milestone?.color ?? "#6366f1");
      setTasks(milestone?.tasks ?? []);
      setNewTaskTitle("");
    }
    onOpenChange(open);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        color,
        ...(isEdit ? {} : orderId ? { orderId } : { projectId }),
      };

      const url = isEdit
        ? `/api/admin/milestones/${milestone.id}`
        : `/api/admin/milestones`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler beim Speichern");
      }

      const saved = await res.json();
      onSaved(saved);
      toast.success(isEdit ? "Meilenstein aktualisiert" : "Meilenstein erstellt");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!milestone) return;
    if (!window.confirm(`Meilenstein "${milestone.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/milestones/${milestone.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onDeleted?.(milestone.id);
      toast.success("Meilenstein gelöscht");
      onOpenChange(false);
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleTask(task: MilestoneTask) {
    if (!isEdit) return;
    try {
      const res = await fetch(
        `/api/admin/milestones/${milestone!.id}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !task.completed }),
        }
      );
      if (!res.ok) return;
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleDeleteTask(task: MilestoneTask) {
    if (!isEdit) return;
    try {
      const res = await fetch(
        `/api/admin/milestones/${milestone!.id}/tasks/${task.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !isEdit) return;
    try {
      const res = await fetch(`/api/admin/milestones/${milestone!.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle.trim() }),
      });
      if (!res.ok) return;
      const task = await res.json();
      setTasks((prev) => [...prev, task]);
      setNewTaskTitle("");
    } catch {
      toast.error("Fehler beim Hinzufügen");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Meilenstein bearbeiten" : "Meilenstein hinzufügen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="milestone-name">Name *</Label>
            <Input
              id="milestone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Design abgeschlossen"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-description">Beschreibung</Label>
            <Textarea
              id="milestone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-due">Fälligkeitsdatum</Label>
            <Input
              id="milestone-due"
              type="date"
              value={dueAt}
              min={minDateStr}
              max={maxDateStr}
              onChange={(e) => setDueAt(e.target.value)}
              className={dateOutOfRange ? "border-destructive" : ""}
            />
            {dateOutOfRange ? (
              <p className="text-[11px] text-destructive">
                {dueAt < (minDateStr ?? "") ? "Datum liegt vor dem Erstelldatum" : "Datum liegt nach der Deadline"}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Ohne Datum erscheint kein Symbol im Zeitplan
                {(minDateStr || maxDateStr) && (
                  <span>
                    {" · "}
                    {minDateStr && maxDateStr
                      ? `${minDateStr} – ${maxDateStr}`
                      : minDateStr
                      ? `ab ${minDateStr}`
                      : `bis ${maxDateStr}`}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Farbe</Label>
            <div className="flex gap-2">
              {MILESTONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                  }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label>Aufgaben</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleTask(task)}
                    />
                    <span className={task.completed ? "line-through text-muted-foreground text-sm flex-1" : "text-sm flex-1"}>
                      {task.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteTask(task)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="+ Aufgabe hinzufügen"
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          {isEdit ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              Löschen
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || dateOutOfRange}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
