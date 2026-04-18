"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, GanttChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectKanbanBoard } from "./ProjectKanbanBoard";
import { ProjectGantt } from "./ProjectGantt";
import { CreateProjectDialog } from "./CreateProjectDialog";
import type { ProjectKanbanItem, ProjectPhaseData } from "./ProjectKanbanBoard";
import type { GanttProject } from "./ProjectGantt";

interface GanttUser {
  id: string;
  name: string;
  email: string;
}

interface ProjectsViewProps {
  phases: ProjectPhaseData[];
  projects: ProjectKanbanItem[];
  ganttProjects: GanttProject[];
  isAdmin: boolean;
  users: GanttUser[];
}

type ViewMode = "kanban" | "gantt";

export function ProjectsView({ phases, projects, ganttProjects, isAdmin, users }: ProjectsViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [createOpen, setCreateOpen] = useState(false);

  const viewToggle = (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1.5 text-xs", viewMode === "kanban" && "bg-muted")}
        onClick={() => setViewMode("kanban")}
      >
        <Kanban className="h-3.5 w-3.5" />
        Kanban
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1.5 text-xs", viewMode === "gantt" && "bg-muted")}
        onClick={() => setViewMode("gantt")}
      >
        <GanttChart className="h-3.5 w-3.5" />
        Gantt
      </Button>
    </div>
  );

  if (viewMode === "kanban") {
    return (
      <ProjectKanbanBoard
        phases={phases}
        initialProjects={projects}
        viewToggle={viewToggle}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground text-sm">Gantt-Ansicht</p>
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          <div className="w-px h-5 bg-border" />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Neues Projekt
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ProjectGantt initialProjects={ganttProjects} users={users} />
      </div>
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(_project) => router.refresh()}
      />
    </div>
  );
}
