"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FolderOpen,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Unlink,
  User,
} from "lucide-react";
import { LinkOrderDialog } from "@/components/admin/LinkOrderDialog";
import { FileDropZone } from "@/components/admin/files/FileDropZone";
import { RoadmapStrip, type SprintUI } from "@/components/admin/RoadmapStrip";
import { DeadlineChip, AssigneeStack, getInitials } from "@/components/admin/HeaderChips";
import { cn, formatDate, formatFileSize, localeToDateLocale } from "@/lib/utils";

// ---- Types ----

interface ProjectOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  deadline: string | null;
  projectId: string | null;
  phase: { id: string; name: string; color: string };
  assignees?: { userId: string; user: { id: string; name: string } }[];
}

interface FilePhase {
  id: string;
  name: string;
  color: string;
}

interface ProjectFileData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  phase: FilePhase | null;
  createdAt: string;
}

interface ProjectCommentData {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
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
  orders: ProjectOrder[];
  files: ProjectFileData[];
  comments: ProjectCommentData[];
  auditLogs: AuditEntry[];
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
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
  filePhases: FilePhase[];
  sprints: SprintUI[];
}

// ---- Helpers ----

function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    PROJECT_CREATED: "Projekt erstellt",
    STATUS_CHANGED: "Status geändert",
    PHASE_CHANGED: "Phase geändert",
    ORDER_LINKED: "Auftrag verknüpft",
    ORDER_UNLINKED: "Auftrag entfernt",
    FILE_UPLOADED: "Datei hochgeladen",
    FILE_PHASE_CHANGED: "Dateiphase geändert",
    FILE_DELETED: "Datei gelöscht",
    COMMENT_ADDED: "Kommentar hinzugefügt",
  };
  return map[action] ?? action;
}

// ---- Phase chip (header) ----

function PhaseChip({
  phases,
  value,
  onChange,
  changeLabel,
}: {
  phases: PhaseOption[];
  value: string;
  onChange: (id: string) => void | Promise<void>;
  changeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = phases.find((p) => p.id === value) ?? phases[0];
  if (!current) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="project-phase-chip"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-[filter] hover:brightness-95"
          style={{
            borderColor: current.color + "33",
            background: current.color + "16",
            color: current.color,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: current.color }}
          />
          {current.name}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {changeLabel}
        </div>
        <div className="flex flex-col gap-px">
          {phases.map((p) => {
            const active = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent",
                  active && "bg-accent font-medium"
                )}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                {active && <Check className="h-3.5 w-3.5 opacity-60" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- Comment composer (shared by the "Alle" and "Kommentare" tabs) ----

function CommentComposer({
  comment,
  setComment,
  onSubmit,
  commenting,
}: {
  comment: string;
  setComment: (v: string) => void;
  onSubmit: () => void;
  commenting: boolean;
}) {
  const t = useTranslations("admin");
  return (
    <div className="px-6 pt-4 pb-5 space-y-3">
      <div className="flex gap-3 items-start">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <Textarea
          className="flex-1 resize-none text-sm min-h-[80px]"
          placeholder={t("project_detail_comment_placeholder")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          data-testid="project-comment-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
          }}
        />
      </div>
      <div className="flex items-center justify-between pl-11">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>↩</Kbd>
          </KbdGroup>
          <span>{t("project_detail_comment_hint_send")}</span>
        </div>
        <Button size="sm" onClick={onSubmit} disabled={!comment.trim() || commenting}>
          <Send className="h-3 w-3 mr-1.5" />
          {commenting ? t("project_detail_saving") : t("project_detail_comment_send")}
        </Button>
      </div>
    </div>
  );
}

// ---- Component ----

export function ProjectDetail({
  project: initial,
  teamMembers,
  phases,
  filePhases,
  sprints,
}: ProjectDetailProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const rawLocale = useLocale();
  const dateLocale = localeToDateLocale(rawLocale);
  const [project, setProject] = useState<ProjectDetailData>(initial);

  // Edit state — name/description are saved via the form; deadline + assignees
  // are edited inline in the sticky header (like the order detail view).
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    project.assignees.map((a) => a.userId)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Files
  const [uploading, setUploading] = useState(false);

  // Comments + activity feed
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const allFeedRef = useRef<HTMLDivElement>(null);
  const commentsFeedRef = useRef<HTMLDivElement>(null);
  const historyFeedRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [linkOrderOpen, setLinkOrderOpen] = useState(false);

  type ActivityItem =
    | { kind: "comment"; data: ProjectCommentData }
    | { kind: "audit"; data: AuditEntry };

  // Ascending (oldest → newest) for chat-style display
  const allActivityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...project.comments.map((c) => ({ kind: "comment", data: c } as ActivityItem)),
      ...project.auditLogs.map((l) => ({ kind: "audit", data: l } as ActivityItem)),
    ];
    return items.sort(
      (a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime()
    );
  }, [project.comments, project.auditLogs]);

  // Auto-scroll to newest whenever items are added
  useEffect(() => {
    allFeedRef.current?.scrollTo({ top: allFeedRef.current.scrollHeight, behavior: "instant" });
  }, [allActivityItems.length]);
  useEffect(() => {
    commentsFeedRef.current?.scrollTo({ top: commentsFeedRef.current.scrollHeight, behavior: "instant" });
  }, [project.comments.length]);
  useEffect(() => {
    historyFeedRef.current?.scrollTo({ top: historyFeedRef.current.scrollHeight, behavior: "instant" });
  }, [project.auditLogs.length]);

  const hasDetailChanges =
    name !== project.name || description !== (project.description ?? "");

  // ---- Project field updates ----

  async function patchProject(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const updated = await res.json();
    setProject((prev) => ({
      ...prev,
      name: updated.name,
      description: updated.description,
      projectPhase: updated.projectPhase ?? prev.projectPhase,
      deadline: updated.deadline ?? null,
      assignees: updated.assignees ?? prev.assignees,
    }));
    return true;
  }

  async function handleSaveDetails() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ok = await patchProject({
        name: name.trim(),
        description: description.trim() || null,
      });
      if (!ok) throw new Error();
      toast.success(t("project_detail_saved"));
    } catch {
      toast.error(t("project_detail_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhaseChange(phaseId: string) {
    const prevPhase = project.projectPhase;
    const next = phases.find((p) => p.id === phaseId);
    if (!next) return;
    setProject((prev) => ({ ...prev, projectPhase: next }));
    const ok = await patchProject({ projectPhaseId: phaseId });
    if (!ok) {
      setProject((prev) => ({ ...prev, projectPhase: prevPhase }));
      toast.error(t("project_detail_save_failed"));
    }
  }

  async function handleAssigneesChange(ids: string[]) {
    const prev = assigneeIds;
    setAssigneeIds(ids);
    const ok = await patchProject({ assigneeIds: ids });
    if (!ok) {
      setAssigneeIds(prev);
      toast.error(t("project_detail_save_failed"));
    }
  }

  async function handleDeadlineChange(iso: string | null) {
    const prev = project.deadline;
    setProject((p) => ({ ...p, deadline: iso }));
    const ok = await patchProject({ deadline: iso });
    if (!ok) {
      setProject((p) => ({ ...p, deadline: prev }));
      toast.error(t("project_detail_save_failed"));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("project_detail_deleted"));
      router.push("/admin/projects");
    } catch {
      toast.error(t("project_detail_delete_failed"));
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
      toast.success(t("project_detail_order_unlinked"));
    } catch {
      toast.error(t("project_detail_unlink_failed"));
    }
  }

  function handleOrderLinked(order: ProjectOrder) {
    setProject((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
  }

  // ---- Files ----

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/admin/projects/${project.id}/files`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const { files: saved } = (await res.json()) as { files: ProjectFileData[] };
      setProject((prev) => ({ ...prev, files: [...saved, ...prev.files] }));
      toast.success(t("project_detail_file_uploaded"));
    } catch {
      toast.error(t("project_detail_upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleFilePhaseChange(fileId: string, phaseId: string) {
    const newPhase = phaseId === "none" ? null : filePhases.find((p) => p.id === phaseId) ?? null;
    setProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === fileId ? { ...f, phase: newPhase } : f)),
    }));
    const res = await fetch(`/api/admin/projects/${project.id}/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId: phaseId === "none" ? null : phaseId }),
    });
    if (!res.ok) toast.error(t("project_detail_save_failed"));
  }

  async function handleDeleteFile(fileId: string) {
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setProject((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== fileId) }));
      toast.success(t("project_detail_file_deleted"));
    } catch {
      toast.error(t("project_detail_file_delete_failed"));
    }
  }

  // ---- Comments ----

  async function handleAddComment() {
    if (!comment.trim()) return;
    setCommenting(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as ProjectCommentData;
      setProject((prev) => ({ ...prev, comments: [...prev.comments, saved] }));
      setComment("");
      toast.success(t("project_detail_comment_added"));
    } catch {
      toast.error(t("project_detail_comment_failed"));
    } finally {
      setCommenting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => router.push("/admin/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("project_detail_back")}
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold truncate">{project.name}</span>
          <PhaseChip
            phases={phases}
            value={project.projectPhase.id}
            onChange={handlePhaseChange}
            changeLabel={t("project_detail_change_phase")}
          />
          <DeadlineChip deadline={project.deadline} onChange={handleDeadlineChange} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AssigneeStack
            assigneeIds={assigneeIds}
            team={teamMembers}
            onChange={handleAssigneesChange}
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("project_detail_delete_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("project_detail_delete_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("project_detail_cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? t("project_detail_deleting") : t("project_detail_delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-6 p-6 min-h-0">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Edit form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {t("project_detail_details")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">{t("project_detail_name")} *</Label>
                <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-desc">{t("project_detail_description")}</Label>
                <Textarea
                  id="proj-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t("project_detail_description_placeholder")}
                />
              </div>

              {hasDetailChanges && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveDetails} disabled={saving || !name.trim()}>
                    {saving ? t("project_detail_saving") : t("project_detail_save")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roadmap with sprints */}
          <RoadmapStrip
            projectId={project.id}
            initialSprints={sprints}
            minDate={project.createdAt}
            maxDate={project.deadline}
            locale={rawLocale === "en" ? "en" : "de"}
          />

          {/* Files */}
          <Card data-testid="project-files">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("project_detail_files")} ({project.files.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <FileDropZone
                onFilesDropped={handleUploadFiles}
                onFilesSelected={handleUploadFiles}
                uploading={uploading}
                compact={project.files.length > 0}
              />
              {project.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("project_detail_no_files")}</p>
              ) : (
                <div className="space-y-2">
                  {project.files.map((f) => (
                    <div
                      key={f.id}
                      data-testid="project-file-row"
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.originalName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                      </div>
                      <Select
                        value={f.phase?.id ?? "none"}
                        onValueChange={(v) => handleFilePhaseChange(f.id, v)}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs" data-testid="project-file-phase-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("project_detail_no_phase")}</SelectItem>
                          {filePhases.map((ph) => (
                            <SelectItem key={ph.id} value={ph.id}>
                              {ph.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <a
                        href={`/api/files/projects/${project.id}/${f.filename}`}
                        download={f.originalName}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title={t("project_detail_download")}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                            title={t("project_detail_delete_file")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("project_detail_delete_file_title")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("project_detail_delete_file_desc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("project_detail_cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteFile(f.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("project_detail_delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity (comments + history) */}
          <Card data-testid="project-comments">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="font-semibold text-base">{t("project_detail_activity_title")}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {project.comments.length} {t("project_detail_comments")}
                    </span>
                  </div>
                  <TabsList className="bg-transparent h-auto p-0 gap-0.5 shrink-0">
                    {(["all", "comments", "history"] as const).map((v) => (
                      <TabsTrigger
                        key={v}
                        value={v}
                        className="rounded-full px-3 py-1 text-sm font-medium h-auto shadow-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
                      >
                        {v === "all" ? t("project_detail_activity_all")
                          : v === "comments" ? t("project_detail_comments")
                          : t("project_detail_history")}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </CardHeader>

              <Separator />

              {/* Tab: Alle */}
              <TabsContent value="all" className="mt-0 flex flex-col">
                <div ref={allFeedRef} className="max-h-[400px] overflow-y-auto px-6 divide-y divide-border">
                  {allActivityItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("project_detail_no_history")}</p>
                  )}
                  {allActivityItems.map((item) =>
                    item.kind === "audit" ? (
                      <div key={`audit-${item.data.id}`} className="flex gap-3 items-center py-2">
                        <div className="h-8 w-8 flex items-center justify-center shrink-0">
                          <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">
                          {item.data.user && <span className="font-medium text-foreground">{item.data.user.name}</span>}
                          {" "}{auditActionLabel(item.data.action)}
                          {item.data.details && <span className="italic"> · {item.data.details}</span>}
                          <span className="ml-2">{formatDate(item.data.createdAt, dateLocale)}</span>
                        </p>
                      </div>
                    ) : (
                      <div key={`comment-${item.data.id}`} className="flex gap-3 py-3" data-testid="project-comment">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                            {getInitials(item.data.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{item.data.author.name}</span>
                            {" "}
                            <span className="text-muted-foreground">
                              {t("project_detail_activity_commented")} {formatDate(item.data.createdAt, dateLocale)}
                            </span>
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{item.data.content}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <Separator />
                <CommentComposer
                  comment={comment}
                  setComment={setComment}
                  onSubmit={handleAddComment}
                  commenting={commenting}
                />
              </TabsContent>

              {/* Tab: Kommentare */}
              <TabsContent value="comments" className="mt-0 flex flex-col">
                <div ref={commentsFeedRef} className="max-h-[400px] overflow-y-auto px-6 divide-y divide-border">
                  {project.comments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("project_detail_no_comments")}</p>
                  )}
                  {[...project.comments]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((c) => (
                      <div key={c.id} className="flex gap-3 py-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                            {getInitials(c.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{c.author.name}</span>
                            {" "}<span className="text-muted-foreground">{t("project_detail_activity_commented")} {formatDate(c.createdAt, dateLocale)}</span>
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
                <Separator />
                <CommentComposer
                  comment={comment}
                  setComment={setComment}
                  onSubmit={handleAddComment}
                  commenting={commenting}
                />
              </TabsContent>

              {/* Tab: Verlauf */}
              <TabsContent value="history" className="mt-0">
                <div ref={historyFeedRef} className="max-h-[400px] overflow-y-auto px-6 py-2 divide-y divide-border">
                  {project.auditLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("project_detail_no_history")}</p>
                  )}
                  {[...project.auditLogs].reverse().map((l) => (
                    <div key={l.id} className="flex gap-3 items-center py-2">
                      <div className="h-8 w-8 flex items-center justify-center shrink-0">
                        <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">
                        {l.user && <span className="font-medium text-foreground">{l.user.name}</span>}
                        {" "}{auditActionLabel(l.action)}
                        {l.details && <span className="italic"> · {l.details}</span>}
                        <span className="ml-2">{formatDate(l.createdAt, dateLocale)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Linked orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  {t("project_detail_orders")} ({project.orders.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setLinkOrderOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("project_detail_link_order")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {project.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("project_detail_no_orders")}</p>
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
                            {formatDate(order.deadline, dateLocale)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkOrder(order.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      title={t("project_detail_unlink_order")}
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
