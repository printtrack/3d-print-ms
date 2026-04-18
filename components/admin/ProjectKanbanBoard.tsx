"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ProjectKanbanColumn } from "./ProjectKanbanColumn";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface ProjectKanbanItem {
  id: string;
  name: string;
  description: string | null;
  projectPhaseId: string;
  projectPhase: { id: string; name: string; color: string };
  phaseOrder: number;
  deadline: string | null;
  milestoneTotal: number;
  milestoneCompleted: number;
  orderCount: number;
  assignees: { userId: string; user: { id: string; name: string } }[];
}

export interface ProjectPhaseData {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  _count: { projects: number };
}

interface ProjectKanbanBoardProps {
  phases: ProjectPhaseData[];
  initialProjects: ProjectKanbanItem[];
  viewToggle?: React.ReactNode;
}

export function ProjectKanbanBoard({ phases: initialPhases, initialProjects, viewToggle }: ProjectKanbanBoardProps) {
  const [phases, setPhases] = useState(initialPhases);
  const [projects, setProjects] = useState<ProjectKanbanItem[]>(
    initialProjects.map((p) => ({ ...p, projectPhaseId: p.projectPhase.id }))
  );
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>(() =>
    initialPhases.reduce(
      (acc, ph) => ({
        ...acc,
        [ph.id]: initialProjects
          .filter((p) => p.projectPhase.id === ph.id)
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .map((p) => p.id),
      }),
      {} as Record<string, string[]>
    )
  );
  const columnOrdersRef = useRef(columnOrders);
  const savedColumnOrders = useRef<Record<string, string[]>>({});

  useEffect(() => {
    columnOrdersRef.current = columnOrders;
  }, [columnOrders]);

  const [activeProject, setActiveProject] = useState<ProjectKanbanItem | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function getProjectsForPhase(phaseId: string) {
    return (columnOrders[phaseId] ?? [])
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is ProjectKanbanItem => Boolean(p));
  }

  function handleDragStart(event: DragStartEvent) {
    const project = projects.find((p) => p.id === event.active.id);
    setActiveProject(project ?? null);
    savedColumnOrders.current = { ...columnOrdersRef.current };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== "project") return;

    const targetPhaseId =
      overData?.type === "column"
        ? (overData.phaseId as string)
        : overData?.type === "project"
        ? projects.find((p) => p.id === over.id)?.projectPhaseId ?? null
        : null;

    if (!targetPhaseId) return;

    const activeItem = projects.find((p) => p.id === active.id);
    if (!activeItem) return;

    const activePhaseId = activeItem.projectPhaseId;

    if (activePhaseId === targetPhaseId) {
      if (overData?.type !== "project") return;
      setColumnOrders((prev) => {
        const col = prev[targetPhaseId] ?? [];
        const oldIdx = col.indexOf(active.id as string);
        const newIdx = col.indexOf(over.id as string);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
        return { ...prev, [targetPhaseId]: arrayMove(col, oldIdx, newIdx) };
      });
    } else {
      setProjects((prev) => {
        const item = prev.find((p) => p.id === active.id);
        if (!item || item.projectPhaseId === targetPhaseId) return prev;
        const newPhase = phases.find((ph) => ph.id === targetPhaseId)!;
        return prev.map((p) =>
          p.id === active.id
            ? { ...p, projectPhaseId: targetPhaseId, projectPhase: newPhase }
            : p
        );
      });

      setColumnOrders((prev) => {
        const sourceCol = (prev[activePhaseId] ?? []).filter((id) => id !== active.id);
        const targetCol = prev[targetPhaseId] ?? [];

        if (targetCol.includes(active.id as string)) return prev;

        let insertIdx = targetCol.length;
        if (overData?.type === "project") {
          const overIdx = targetCol.indexOf(over.id as string);
          if (overIdx !== -1) insertIdx = overIdx;
        }

        const newTargetCol = [
          ...targetCol.slice(0, insertIdx),
          active.id as string,
          ...targetCol.slice(insertIdx),
        ];

        return {
          ...prev,
          [activePhaseId]: sourceCol,
          [targetPhaseId]: newTargetCol,
        };
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveProject(null);

    if (!over) {
      setColumnOrders(savedColumnOrders.current);
      return;
    }

    const movedProject = projects.find((p) => p.id === active.id);
    if (!movedProject) return;

    const originalProject = initialProjects.find((p) => p.id === active.id);
    const newPhaseId = movedProject.projectPhaseId;

    if (originalProject && originalProject.projectPhase.id !== newPhaseId) {
      // Cross-column: PATCH phase + reorder
      try {
        const res = await fetch(`/api/admin/projects/${active.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPhaseId: newPhaseId }),
        });

        if (!res.ok) {
          toast.error("Phasenänderung fehlgeschlagen");
          setProjects(initialProjects.map((p) => ({ ...p, projectPhaseId: p.projectPhase.id })));
          setColumnOrders(savedColumnOrders.current);
          return;
        }

        const newPhase = phases.find((ph) => ph.id === newPhaseId)!;
        toast.success(`"${movedProject.name}" → ${newPhase.name}`);

        // Update reference
        const idx = initialProjects.findIndex((p) => p.id === active.id);
        if (idx !== -1) {
          initialProjects[idx] = {
            ...initialProjects[idx],
            projectPhase: newPhase,
            projectPhaseId: newPhaseId,
          };
        }

        // Persist column order
        const finalOrder = columnOrdersRef.current[newPhaseId] ?? [];
        if (finalOrder.length > 0) {
          fetch("/api/admin/projects/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phaseId: newPhaseId, projectIds: finalOrder }),
          }).catch(() => {});
        }
      } catch {
        toast.error("Phasenänderung fehlgeschlagen");
        setProjects(initialProjects.map((p) => ({ ...p, projectPhaseId: p.projectPhase.id })));
        setColumnOrders(savedColumnOrders.current);
      }
    } else {
      // Intra-column reorder
      const finalOrder = columnOrdersRef.current[newPhaseId] ?? [];
      if (finalOrder.length > 0) {
        try {
          const res = await fetch("/api/admin/projects/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phaseId: newPhaseId, projectIds: finalOrder }),
          });
          if (!res.ok) throw new Error();
        } catch {
          toast.error("Reihenfolge konnte nicht gespeichert werden");
          setColumnOrders(savedColumnOrders.current);
        }
      }
    }
  }

  function handleCreated(raw: { id: string; name: string; description: string | null; projectPhase: { id: string; name: string; color: string }; deadline: string | null; _count?: { orders: number }; assignees?: { userId: string; user: { id: string; name: string } }[]; milestones?: { completedAt: string | null }[] }) {
    const item: ProjectKanbanItem = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      projectPhaseId: raw.projectPhase.id,
      projectPhase: raw.projectPhase,
      phaseOrder: 0,
      deadline: raw.deadline ?? null,
      milestoneTotal: raw.milestones?.length ?? 0,
      milestoneCompleted: raw.milestones?.filter((m) => m.completedAt !== null).length ?? 0,
      orderCount: raw._count?.orders ?? 0,
      assignees: raw.assignees ?? [],
    };
    setProjects((prev) => [item, ...prev]);
    setColumnOrders((prev) => ({
      ...prev,
      [item.projectPhaseId]: [item.id, ...(prev[item.projectPhaseId] ?? [])],
    }));
    initialProjects.unshift(item);
  }

  function handleMobileMove(projectId: string, newPhaseId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.projectPhaseId === newPhaseId) return;

    const newPhase = phases.find((ph) => ph.id === newPhaseId)!;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, projectPhaseId: newPhaseId, projectPhase: newPhase } : p
      )
    );

    fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPhaseId: newPhaseId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        toast.success(`"${project.name}" → ${newPhase.name}`);
        setActiveTab(phases.findIndex((ph) => ph.id === newPhaseId));
      })
      .catch(() => {
        toast.error("Phasenänderung fehlgeschlagen");
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, projectPhaseId: project.projectPhaseId, projectPhase: project.projectPhase }
              : p
          )
        );
      });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground text-sm">{projects.length} Projekt{projects.length !== 1 ? "e" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          <div className="w-px h-5 bg-border" />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Neues Projekt
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        id="project-kanban-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Desktop board */}
        <div className="hidden md:flex gap-6 overflow-x-scroll overflow-y-hidden pb-6 pt-2 px-6 h-full">
          <div className="flex gap-6 h-full min-w-max">
            {phases.map((phase) => (
              <ProjectKanbanColumn
                key={phase.id}
                phase={phase}
                projects={getProjectsForPhase(phase.id)}
              />
            ))}
          </div>
        </div>

        {/* Mobile tab view */}
        <div className="flex flex-col md:hidden h-full">
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 flex-shrink-0">
            {phases.map((phase, index) => (
              <button
                key={phase.id}
                onClick={() => setActiveTab(index)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border flex-shrink-0 transition-colors",
                  activeTab === index
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
                {phase.name}
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                  {getProjectsForPhase(phase.id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-1 pt-2 pb-6 space-y-2">
            {phases[activeTab] &&
              getProjectsForPhase(phases[activeTab].id).map((project) => (
                <div key={project.id} className="bg-card border rounded-lg p-3 shadow-sm space-y-2">
                  <Link href={`/admin/projects/${project.id}`} className="block">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                    )}
                  </Link>
                  <select
                    value={project.projectPhaseId}
                    onChange={(e) => handleMobileMove(project.id, e.target.value)}
                    className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-muted-foreground"
                  >
                    {phases.map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.id === project.projectPhaseId ? `Phase: ${ph.name}` : `→ ${ph.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            {phases[activeTab] && getProjectsForPhase(phases[activeTab].id).length === 0 && (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                Keine Projekte
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeProject && (
            <div className="rotate-3 scale-105">
              <div className="bg-card border rounded-lg p-3 shadow-xl w-[280px] opacity-90">
                <p className="font-medium text-sm">{activeProject.name}</p>
                {activeProject.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{activeProject.description}</p>
                )}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
