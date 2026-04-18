"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, FolderOpen, Target, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProjectCardProject {
  id: string;
  name: string;
  description: string | null;
  projectPhase: { id: string; name: string; color: string };
  deadline: string | null;
  milestoneTotal: number;
  milestoneCompleted: number;
  orderCount: number;
  assignees: { userId: string; user: { id: string; name: string } }[];
}

function getDeadlineBadge(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const label = d.toLocaleDateString("de-DE");

  if (diffMs < 0) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
        <CalendarClock className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  } else if (diffMs <= 48 * 60 * 60 * 1000) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
        <CalendarClock className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  } else {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
        <CalendarClock className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  }
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function ProjectCard({ project }: { project: ProjectCardProject }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { type: "project" },
  });

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none" as const,
  };

  const progressPct =
    project.milestoneTotal > 0
      ? Math.round((project.milestoneCompleted / project.milestoneTotal) * 100)
      : null;

  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative border rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all overflow-hidden",
        isOverdue ? "bg-red-50/40" : "bg-card"
      )}
    >
      {/* Phase color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: project.projectPhase.color }}
      />
      <Link
        href={`/admin/projects/${project.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block p-3 pl-[18px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="font-semibold text-sm line-clamp-1">{project.name}</p>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {project.deadline && getDeadlineBadge(project.deadline)}
          </div>

          {/* Milestone progress bar */}
          {progressPct !== null && (
            <div className="space-y-1">
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
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: project.projectPhase.color,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="h-3 w-3 shrink-0" />
              {project.orderCount} Auftr{project.orderCount !== 1 ? "äge" : "ag"}
            </span>

            {project.assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {project.assignees.slice(0, 3).map((a) => (
                  <div
                    key={a.userId}
                    className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted-foreground"
                    title={a.user.name}
                  >
                    {getInitials(a.user.name)}
                  </div>
                ))}
                {project.assignees.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-medium text-muted-foreground">
                    +{project.assignees.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <Users className="h-3 w-3 text-muted-foreground opacity-30" />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
