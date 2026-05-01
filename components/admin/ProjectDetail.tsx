"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  FolderOpen,
  Plus,
  Trash2,
  Unlink,
  Users,
} from "lucide-react";
import { MilestoneDialog } from "@/components/admin/MilestoneDialog";
import { LinkOrderDialog } from "@/components/admin/LinkOrderDialog";
import { cn, formatDateTime } from "@/lib/utils";
import { AssigneePicker } from "@/components/admin/AssigneePicker";

// ---- Types ----

interface MilestoneTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  assignees: { user: { id: string; name: string } }[];
  position: number;
}

interface MilestoneData {
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

interface ProjectOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  deadline: string | null;
  projectId: string | null;
  phase: { id: string; name: string; color: string };
  assignees?: { userId: string; user: { id: string; name: string } }[];
}

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface ProjectDetailData {
  id: string;
  name: string;
  description: string | null;
  projectPhase: { id: string; name: string; color: string };
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: { userId: string; user: { id: string; name: string } }[];
  milestones: MilestoneData[];
  orders: ProjectOrder[];
  auditLogs: AuditEntry[];
}

interface TeamMember {
  id: string;
  name: string;
}

interface PhaseOption {
  id: string;
  name: string;
  color: string;
}

interface ProjectDetailProps {
  project: ProjectDetailData;
  teamMembers: TeamMember[];
  phases: PhaseOption[];
}

// ---- Constants ----

function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    PROJECT_CREATED: "Projekt erstellt",
    STATUS_CHANGED: "Status geändert",
    PHASE_CHANGED: "Phase geändert",
    ORDER_LINKED: "Auftrag verknüpft",
    ORDER_UNLINKED: "Auftrag entfernt",
  };
  return map[action] ?? action;
}

// ---- Component ----

export function ProjectDetail({ project: initial, teamMembers, phases }: ProjectDetailProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetailData>(initial);

  // Edit state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [projectPhaseId, setProjectPhaseId] = useState(project.projectPhase.id);
  const [deadline, setDeadline] = useState(
    project.deadline ? project.deadline.slice(0, 10) : ""
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    project.assignees.map((a) => a.userId)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialogs
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean;
    milestone: MilestoneData | null;
  }>({ open: false, milestone: null });
  const [linkOrderOpen, setLinkOrderOpen] = useState(false);

  const hasChanges =
    name !== project.name ||
    description !== (project.description ?? "") ||
    projectPhaseId !== project.projectPhase.id ||
    deadline !== (project.deadline ? project.deadline.slice(0, 10) : "") ||
    JSON.stringify(assigneeIds.sort()) !==
      JSON.stringify(project.assignees.map((a) => a.userId).sort());

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          projectPhaseId,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          assigneeIds,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setProject(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      setProjectPhaseId(updated.projectPhase?.id ?? projectPhaseId);
      setDeadline(updated.deadline ? updated.deadline.slice(0, 10) : "");
      setAssigneeIds(updated.assignees.map((a: { userId: string }) => a.userId));
      toast.success("Gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Projekt gelöscht");
      router.push("/admin/projects");
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnlinkOrder(orderId: string) {
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setProject((prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o.id !== orderId),
      }));
      toast.success("Auftrag entfernt");
    } catch {
      toast.error("Fehler beim Entfernen");
    }
  }

  function handleMilestoneSaved(saved: MilestoneData) {
    setProject((prev) => {
      const exists = prev.milestones.some((m) => m.id === saved.id);
      return {
        ...prev,
        milestones: exists
          ? prev.milestones.map((m) => (m.id === saved.id ? saved : m))
          : [...prev.milestones, saved],
      };
    });
  }

  function handleMilestoneDeleted(id: string) {
    setProject((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
  }

  async function handleToggleMilestone(m: MilestoneData) {
    const newCompletedAt = m.completedAt ? null : new Date().toISOString();
    setProject((prev) => ({
      ...prev,
      milestones: prev.milestones.map((ms) =>
        ms.id === m.id ? { ...ms, completedAt: newCompletedAt } : ms
      ),
    }));
    try {
      const res = await fetch(`/api/admin/milestones/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: newCompletedAt }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setProject((prev) => ({
        ...prev,
        milestones: prev.milestones.map((ms) => (ms.id === saved.id ? saved : ms)),
      }));
    } catch {
      // revert
      setProject((prev) => ({
        ...prev,
        milestones: prev.milestones.map((ms) => (ms.id === m.id ? m : ms)),
      }));
    }
  }

  function handleOrderLinked(order: ProjectOrder) {
    setProject((prev) => ({
      ...prev,
      orders: [order, ...prev.orders],
    }));
  }

const sortedMilestones = [...project.milestones].sort((a, b) => {
    if (a.completedAt && !b.completedAt) return 1;
    if (!a.completedAt && b.completedAt) return -1;
    if (!a.completedAt && !b.completedAt) {
      if (a.dueAt && !b.dueAt) return -1;
      if (!a.dueAt && b.dueAt) return 1;
      if (a.dueAt && b.dueAt)
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    }
    return a.position - b.position;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => router.push("/admin/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
            Projekte
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold truncate">{project.name}</span>
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: project.projectPhase.color }}
          >
            {project.projectPhase.name}
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Projekt wird unwiderruflich gelöscht. Verknüpfte Aufträge bleiben erhalten.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Löschen..." : "Löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-6 p-6 min-h-0">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Edit form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Projektdetails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Name *</Label>
                <Input
                  id="proj-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-desc">Beschreibung</Label>
                <Textarea
                  id="proj-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phase</Label>
                  <Select value={projectPhaseId} onValueChange={setProjectPhaseId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((ph) => (
                        <SelectItem key={ph.id} value={ph.id}>
                          {ph.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="proj-deadline">Deadline</Label>
                  <Input
                    id="proj-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              {hasChanges && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                    {saving ? "Speichern..." : "Änderungen speichern"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Aufträge ({project.orders.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setLinkOrderOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Verknüpfen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {project.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Aufträge verknüpft</p>
              ) : (
                project.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-medium hover:underline truncate block"
                      >
                        {order.customerName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: order.phase.color }}
                        >
                          {order.phase.name}
                        </span>
                        {order.deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(order.deadline).toLocaleDateString("de-DE")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkOrder(order.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      title="Verknüpfung entfernen"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Audit log */}
          {project.auditLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Aktivitätsprotokoll
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {project.auditLogs.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <span className="text-muted-foreground text-xs mt-0.5 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{auditActionLabel(entry.action)}</span>
                      {entry.details && (
                        <span className="text-muted-foreground"> — {entry.details}</span>
                      )}
                      {entry.user && (
                        <span className="text-muted-foreground"> von {entry.user.name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Assignees */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Zugewiesen
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <AssigneePicker
                users={teamMembers}
                value={assigneeIds}
                onChange={(ids) => setAssigneeIds(ids)}
              />
              {hasChanges && (
                <Button size="sm" className="w-full mt-1" onClick={handleSave} disabled={saving}>
                  {saving ? "Speichern..." : "Änderungen speichern"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Meilensteine ({project.milestones.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMilestoneDialog({ open: true, milestone: null })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Neu
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {sortedMilestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Meilensteine</p>
              ) : (
                sortedMilestones.map((m) => {
                  const isOverdue =
                    !!m.dueAt && !m.completedAt && new Date(m.dueAt) < new Date();
                  const tasksDone = m.tasks.filter((t) => t.completed).length;
                  const tasksTotal = m.tasks.length;
                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      className="flex items-start gap-2 rounded-md p-2 hover:bg-muted cursor-pointer"
                      onClick={() => setMilestoneDialog({ open: true, milestone: m })}
                    >
                      <button
                        className="mt-0.5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMilestone(m);
                        }}
                      >
                        {m.completedAt ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle
                            className={cn("h-4 w-4", isOverdue && "animate-pulse")}
                            style={{ color: m.color }}
                          />
                        )}
                      </button>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            m.completedAt && "line-through text-muted-foreground"
                          )}
                        >
                          {m.name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.dueAt && (
                            <span
                              className={cn(
                                "text-xs",
                                isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                              )}
                            >
                              {new Date(m.dueAt).toLocaleDateString("de-DE")}
                            </span>
                          )}
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              Überfällig
                            </Badge>
                          )}
                          {m.completedAt && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              Erledigt
                            </Badge>
                          )}
                        </div>
                        {tasksTotal > 0 && (
                          <div className="flex items-center gap-1.5 w-full mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.round((tasksDone / tasksTotal) * 100)}%`,
                                  backgroundColor: m.color,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {tasksDone}/{tasksTotal}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Milestone dialog */}
      <MilestoneDialog
        key={milestoneDialog.milestone?.id ?? "new"}
        open={milestoneDialog.open}
        onOpenChange={(open) => setMilestoneDialog((s) => ({ ...s, open }))}
        projectId={project.id}
        milestone={milestoneDialog.milestone}
        users={teamMembers}
        onSaved={handleMilestoneSaved}
        onDeleted={handleMilestoneDeleted}
        minDate={project.createdAt}
        maxDate={project.deadline}
      />

      {/* Link order dialog */}
      <LinkOrderDialog
        open={linkOrderOpen}
        onOpenChange={setLinkOrderOpen}
        projectId={project.id}
        alreadyLinkedIds={project.orders.map((o) => o.id)}
        onLinked={handleOrderLinked}
      />
    </div>
  );
}
