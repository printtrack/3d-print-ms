"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { ProjectKanbanItem } from "./ProjectKanbanBoard";

interface User {
  id: string;
  name: string;
  email?: string;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optionally pass users from parent; if omitted they are fetched from the API */
  users?: User[];
  onCreated: (project: ProjectKanbanItem) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  users: usersProp,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>(usersProp ?? []);

  useEffect(() => {
    if (usersProp) {
      setUsers(usersProp);
      return;
    }
    if (!open) return;
    fetch("/api/admin/team")
      .then((r) => r.json())
      .then((data: User[]) => setUsers(data))
      .catch(() => {});
  }, [open, usersProp]);

  function reset() {
    setName("");
    setDescription("");
    setDeadline("");
    setAssigneeIds([]);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          assigneeIds,
        }),
      });

      if (!res.ok) throw new Error("Fehler beim Erstellen");

      const raw = await res.json();
      const project: ProjectKanbanItem = {
        id: raw.id,
        name: raw.name,
        description: raw.description,
        projectPhaseId: raw.projectPhase?.id ?? "",
        projectPhase: raw.projectPhase ?? { id: "", name: "", color: "#6366f1" },
        phaseOrder: raw.phaseOrder ?? 0,
        deadline: raw.deadline ?? null,
        orderCount: raw._count?.orders ?? 0,
        assignees: raw.assignees ?? [],
        milestoneTotal: raw.milestones?.length ?? 0,
        milestoneCompleted: raw.milestones?.filter((m: { completedAt: string | null }) => m.completedAt !== null).length ?? 0,
      };
      onCreated(project);
      toast.success("Projekt erstellt");
      onOpenChange(false);
    } catch {
      toast.error("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  }

  const selectedUsers = users.filter((u) => assigneeIds.includes(u.id));
  const unselectedUsers = users.filter((u) => !assigneeIds.includes(u.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Projekt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Projektname"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Beschreibung</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-deadline">Deadline</Label>
            <Input
              id="project-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Zugewiesen an</Label>
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedUsers.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1 pl-2 pr-1">
                    {u.name}
                    <button
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {unselectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {unselectedUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleAssignee(u.id)}
                    className="text-xs px-2 py-0.5 rounded-md border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    + {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? "Erstellen..." : "Erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
