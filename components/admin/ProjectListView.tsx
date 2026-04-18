"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateProjectDialog } from "./CreateProjectDialog";
import type { ProjectKanbanItem } from "./ProjectKanbanBoard";
import { FolderOpen, Users, Target, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: string | null;
  createdAt: string;
  orderCount: number;
  assignees: { userId: string; user: { id: string; name: string } }[];
  milestoneTotal: number;
  milestoneCompleted: number;
}

interface ProjectListViewProps {
  projects: ProjectListItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planung",
  ACTIVE: "Aktiv",
  ON_HOLD: "Pausiert",
  COMPLETED: "Abgeschlossen",
  ARCHIVED: "Archiviert",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ON_HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  COMPLETED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ARCHIVED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

const STATUS_HEX: Record<string, string> = {
  PLANNING: "#6366f1",
  ACTIVE: "#10b981",
  ON_HOLD: "#f59e0b",
  COMPLETED: "#6b7280",
  ARCHIVED: "#9ca3af",
};

const FILTER_TABS = [
  { key: "all", label: "Alle" },
  { key: "PLANNING", label: "Planung" },
  { key: "ACTIVE", label: "Aktiv" },
  { key: "ON_HOLD", label: "Pausiert" },
  { key: "COMPLETED", label: "Abgeschlossen" },
];

export function ProjectListView({ projects: initialProjects }: ProjectListViewProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>(initialProjects);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered =
    statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter);

  function handleCreated(p: ProjectKanbanItem) {
    router.push(`/admin/projects/${p.id}`);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground text-sm">{projects.length} Projekt{projects.length !== 1 ? "e" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Neues Projekt
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 py-3 border-b flex-shrink-0">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? projects.length
              : projects.filter((p) => p.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label} <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Project cards */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Keine Projekte gefunden</p>
            {statusFilter === "all" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
              >
                Erstes Projekt erstellen
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/admin/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectListItem;
  onClick: () => void;
}) {
  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== "COMPLETED" &&
    project.status !== "ARCHIVED";

  const progressPct =
    project.milestoneTotal > 0
      ? Math.round((project.milestoneCompleted / project.milestoneTotal) * 100)
      : null;

  const accentColor = STATUS_HEX[project.status] ?? STATUS_HEX.PLANNING;

  return (
    <button
      onClick={onClick}
      className="text-left bg-card border border-l-4 rounded-lg p-4 hover:shadow-md transition-all space-y-3 group"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <span
          className={cn(
            "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
            STATUS_COLORS[project.status] ?? STATUS_COLORS.PLANNING
          )}
        >
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
      )}

      {/* Milestone progress bar */}
      {progressPct !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Meilensteine
            </span>
            <span className="tabular-nums">
              {project.milestoneCompleted}/{project.milestoneTotal}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
            />
          </div>
        </div>
      )}

      {/* Footer: deadline + orders + assignees */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
        <div className="flex items-center gap-3">
          {project.deadline && (
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "text-destructive font-medium"
              )}
            >
              <Clock className="h-3 w-3" />
              {new Date(project.deadline).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              {isOverdue && " ⚠"}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {project.orderCount} Auftr{project.orderCount !== 1 ? "äge" : "ag"}
          </span>
        </div>

        {project.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {project.assignees.slice(0, 4).map((a) => (
              <div
                key={a.userId}
                className="w-5 h-5 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted-foreground"
                title={a.user.name}
              >
                {a.user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
              </div>
            ))}
            {project.assignees.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-medium text-muted-foreground">
                +{project.assignees.length - 4}
              </div>
            )}
          </div>
        ) : (
          <Users className="h-3 w-3 opacity-30" />
        )}
      </div>
    </button>
  );
}
