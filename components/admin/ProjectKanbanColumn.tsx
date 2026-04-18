"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ProjectCard } from "./ProjectCard";

interface ProjectKanbanColumnProps {
  phase: { id: string; name: string; color: string };
  projects: {
    id: string;
    name: string;
    description: string | null;
    projectPhase: { id: string; name: string; color: string };
    deadline: string | null;
    milestoneTotal: number;
    milestoneCompleted: number;
    orderCount: number;
    assignees: { userId: string; user: { id: string; name: string } }[];
  }[];
}

export function ProjectKanbanColumn({ phase, projects }: ProjectKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: phase.id,
    data: { type: "column", phaseId: phase.id },
  });

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[280px]">
      {/* Column Header */}
      <div className="mb-3 px-1">
        <div className="h-1 rounded-full mb-3" style={{ backgroundColor: phase.color }} />
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[13px]">{phase.name}</h3>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white leading-none shrink-0"
            style={{ backgroundColor: phase.color }}
          >
            {projects.length}
          </span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg p-2 space-y-2 transition-colors overflow-y-auto ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        }`}
      >
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </SortableContext>

        {projects.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground opacity-50">
            Noch keine Projekte
          </div>
        )}
      </div>
    </div>
  );
}
