"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Flag, Plus, X, Trash2, MoreVertical, Pencil, Route, AlertTriangle, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface MilestoneTaskUI {
  id: string;
  title: string;
  completed: boolean;
}

export interface MilestoneUI {
  id: string;
  name: string;
  dueAt: string | null;
  completedAt: string | null;
  tasks: MilestoneTaskUI[];
}

export interface SprintUI {
  id: string;
  name: string;
  position: number;
  milestones: MilestoneUI[];
}

interface RoadmapStripProps {
  /** Provide exactly one of orderId / projectId — determines which entity the sprints belong to */
  orderId?: string;
  projectId?: string;
  initialSprints: SprintUI[];
  /** ISO date — earliest valid dueAt */
  minDate?: string | null;
  /** ISO date — latest valid dueAt */
  maxDate?: string | null;
  locale: "de" | "en";
}

type StopState = "done" | "current" | "upcoming" | "overdue";
interface ComputedStop extends MilestoneUI {
  iso: string | null;
  dateLabel: string;
  tasksDone: number;
  tasksAll: number;
  state: StopState;
}

const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShort(iso: string | null, loc: "de" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = loc === "en" ? MONTHS_EN : MONTHS_DE;
  return loc === "en" ? `${months[d.getMonth()]} ${d.getDate()}` : `${d.getDate()}. ${months[d.getMonth()]}`;
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoFromInput(value: string): string {
  // value is "YYYY-MM-DD" — anchor to midday UTC to dodge TZ off-by-one drift
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function sprintRangeLabel(milestones: MilestoneUI[], loc: "de" | "en"): string {
  const withDates = milestones.filter((m) => m.dueAt).sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1));
  if (withDates.length === 0) return loc === "en" ? "empty" : "leer";
  const months = loc === "en" ? MONTHS_EN : MONTHS_DE;
  const first = new Date(withDates[0].dueAt!);
  const last = new Date(withDates[withDates.length - 1].dueAt!);
  const a = months[first.getMonth()];
  const b = months[last.getMonth()];
  return a === b ? a : `${a} – ${b}`;
}

function computeStops(milestones: MilestoneUI[], loc: "de" | "en"): ComputedStop[] {
  const sorted = [...milestones].sort((a, b) => {
    const aIso = a.dueAt ?? "";
    const bIso = b.dueAt ?? "";
    if (aIso === bIso) return 0;
    if (!aIso) return 1;
    if (!bIso) return -1;
    return aIso < bIso ? -1 : 1;
  });
  let foundCurrent = false;
  const now = Date.now();
  return sorted.map((m) => {
    const tasksAll = m.tasks.length;
    const tasksDone = m.tasks.filter((t) => t.completed).length;
    const allDone = !!m.completedAt || (tasksAll > 0 && tasksDone === tasksAll);
    let state: StopState;
    if (allDone) {
      state = "done";
    } else if (!foundCurrent) {
      const overdue = !!m.dueAt && new Date(m.dueAt).getTime() < now;
      state = overdue ? "overdue" : "current";
      foundCurrent = true;
    } else {
      state = "upcoming";
    }
    return {
      ...m,
      iso: m.dueAt,
      dateLabel: formatShort(m.dueAt, loc),
      tasksAll,
      tasksDone,
      state,
    };
  });
}

function dotBackground(s: ComputedStop): string | undefined {
  if (!s.tasksAll || s.state === "done") return undefined;
  const n = s.tasksAll;
  const done = s.tasksDone;
  const slice = 360 / n;
  const gap = n > 1 ? 3 : 0;
  const doneColor = s.state === "overdue" ? "oklch(0.55 0.2 27)" : "var(--brand-accent)";
  const undoneColor = s.state === "overdue" ? "oklch(0.55 0.2 27 / 22%)" : "oklch(0.88 0 0)";
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const startA = i * slice + (i === 0 ? 0 : gap / 2);
    const endA = (i + 1) * slice - (i === n - 1 ? 0 : gap / 2);
    const color = i < done ? doneColor : undoneColor;
    parts.push(`${color} ${startA}deg ${endA}deg`);
    if (i < n - 1) parts.push(`var(--card) ${endA}deg ${endA + gap}deg`);
  }
  return `conic-gradient(from -90deg, ${parts.join(", ")})`;
}

function InlineEdit({
  value,
  onSave,
  onCancel,
  type = "text",
  inputClass = "",
  min,
  max,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel?: () => void;
  type?: "text" | "date";
  inputClass?: string;
  min?: string;
  max?: string;
}) {
  const [temp, setTemp] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (type === "text") ref.current?.select();
  }, [type]);
  const save = () => {
    const v = type === "date" ? temp : temp.trim();
    if (v && v !== value) onSave(v);
    else onCancel?.();
  };
  return (
    <input
      ref={ref}
      type={type}
      min={min}
      max={max}
      className={`rs-inline-input ${inputClass}`}
      value={temp}
      onChange={(e) => setTemp(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); save(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel?.(); }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function SprintChip({
  sprint,
  active,
  align,
  menuOpen,
  confirmOpen,
  renaming,
  onClick,
  onMenuToggle,
  onStartRename,
  onRename,
  onCancelRename,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  t,
}: {
  sprint: SprintUI;
  active: boolean;
  align: "left" | "right";
  menuOpen: boolean;
  confirmOpen: boolean;
  renaming: boolean;
  onClick: () => void;
  onMenuToggle: () => void;
  onStartRename: () => void;
  onRename: (v: string) => void;
  onCancelRename: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const totalAll = sprint.milestones.reduce((acc, m) => acc + m.tasks.length, 0);
  const totalDone = sprint.milestones.reduce(
    (acc, m) => acc + m.tasks.filter((task) => task.completed).length + (m.completedAt && m.tasks.length === 0 ? 1 : 0),
    0
  );
  const pct = totalAll === 0 ? 0 : totalDone / totalAll;
  const allMilestonesDone = sprint.milestones.length > 0 && sprint.milestones.every((m) => !!m.completedAt || (m.tasks.length > 0 && m.tasks.every((task) => task.completed)));
  const isDone = sprint.milestones.length > 0 && allMilestonesDone;
  const isEmpty = sprint.milestones.length === 0;

  let ringStyle: React.CSSProperties;
  if (isDone) {
    ringStyle = { background: "oklch(0.6 0.18 145)" };
  } else if (isEmpty) {
    ringStyle = { background: "oklch(0.88 0 0)" };
  } else {
    const deg = pct * 360;
    const filled = active ? "var(--brand-accent)" : "var(--brand-accent-dim)";
    const empty = "oklch(0.88 0 0)";
    ringStyle = { background: `conic-gradient(from -90deg, ${filled} 0deg ${deg}deg, ${empty} ${deg}deg 360deg)` };
  }

  const range = useMemo(() => sprintRangeLabel(sprint.milestones, "de"), [sprint.milestones]);

  return (
    <div className={`rs-menu-anchor align-${align}`}>
      <div
        className={`rs-chip ${active ? "active" : ""} ${isDone ? "done" : ""}`}
        onClick={!renaming ? onClick : undefined}
        style={{ cursor: renaming ? "default" : "pointer" }}
        role="button"
      >
        <span className="rs-chip-ring" style={ringStyle}>
          {isDone ? <Check size={12} color="white" /> : <span className="rs-chip-pct">{Math.round(pct * 100)}</span>}
        </span>
        <span className="rs-chip-text">
          {renaming ? (
            <InlineEdit
              value={sprint.name}
              onSave={(v) => onRename(v)}
              onCancel={onCancelRename}
            />
          ) : (
            <span className="rs-chip-name">{sprint.name}</span>
          )}
          <span className="rs-chip-meta">{range}</span>
        </span>
        <button
          className={`rs-chip-menu ${menuOpen ? "open" : ""}`}
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          title={t("sprint_menu_title")}
          type="button"
          aria-label={t("sprint_menu_title")}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {menuOpen && !confirmOpen && (
        <div className="rs-menu-pop" onClick={(e) => e.stopPropagation()}>
          <button className="rs-menu-item" onClick={onStartRename}>
            <Pencil /> {t("sprint_rename")}
          </button>
          <button className="rs-menu-item danger" onClick={onAskDelete}>
            <Trash2 /> {t("sprint_delete")}
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="rs-sprint-confirm" onClick={(e) => e.stopPropagation()}>
          <h5 className="rs-sprint-confirm-title">
            <AlertTriangle /> {t("sprint_delete")}
          </h5>
          <div className="rs-sprint-confirm-body">
            {t("sprint_delete_body", { name: sprint.name, count: sprint.milestones.length, tasks: totalAll })}
          </div>
          <div className="rs-pop-confirm-actions">
            <button className="text-xs px-2 py-1 rounded hover:bg-muted" onClick={onCancelDelete}>{t("cancel")}</button>
            <button className="rs-btn-danger" onClick={onConfirmDelete}>{t("sprint_delete_confirm")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stop({
  s,
  open,
  onOpenToggle,
  onTaskToggle,
  onTaskAdd,
  onTaskRename,
  onTaskDelete,
  onRenameStop,
  onRescheduleStop,
  onDeleteStop,
  minDate,
  maxDate,
  t,
}: {
  s: ComputedStop;
  open: boolean;
  onOpenToggle: (id: string) => void;
  onTaskToggle: (stopId: string, taskId: string) => void;
  onTaskAdd: (stopId: string, title: string) => void;
  onTaskRename: (stopId: string, taskId: string, title: string) => void;
  onTaskDelete: (stopId: string, taskId: string) => void;
  onRenameStop: (stopId: string, name: string) => void;
  onRescheduleStop: (stopId: string, iso: string) => void;
  onDeleteStop: (stopId: string) => void;
  minDate?: string;
  maxDate?: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const [newTask, setNewTask] = useState("");
  const [animClass, setAnimClass] = useState("");
  const [editing, setEditing] = useState<null | "name" | "date" | { taskId: string }>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const prev = useRef({ tasksDone: s.tasksDone, state: s.state as StopState, mounted: false });

  useEffect(() => {
    if (!prev.current.mounted) {
      prev.current.mounted = true;
      prev.current.tasksDone = s.tasksDone;
      prev.current.state = s.state;
      return;
    }
    let cls = "";
    if (s.state === "done" && prev.current.state !== "done") cls = "anim-complete";
    else if (s.tasksDone > prev.current.tasksDone) cls = "anim-slice";
    prev.current.tasksDone = s.tasksDone;
    prev.current.state = s.state;
    if (!cls) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset+restart animation when data changes
    setAnimClass("");
    const raf = requestAnimationFrame(() => setAnimClass(cls));
    const tid = window.setTimeout(() => setAnimClass(""), 900);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(tid);
    };
  }, [s.tasksDone, s.state]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset transient UI when popover closes
      setEditing(null);
      setConfirmDel(false);
    }
  }, [open]);

  const cls = `rs-stop ${s.state} ${animClass}`.trim();
  const bg = dotBackground(s);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTask.trim();
    if (!trimmed) return;
    onTaskAdd(s.id, trimmed);
    setNewTask("");
  };

  return (
    <div className={cls}>
      <div className="rs-stop-date">{s.dateLabel || " "}</div>
      <button
        type="button"
        className="rs-dot"
        style={bg ? { background: bg } : undefined}
        onClick={(e) => { e.stopPropagation(); onOpenToggle(s.id); }}
        title={t("stop_open_tasks")}
        aria-label={`${s.name} — ${s.tasksDone}/${s.tasksAll}`}
      >
        {s.state === "done" && <Check size={14} />}
        {s.state === "current" && <Flag size={13} />}
        {s.state === "overdue" && <AlertTriangle size={13} />}
        {animClass === "anim-complete" && (
          <>
            <span className="rs-spark" /><span className="rs-spark" />
            <span className="rs-spark" /><span className="rs-spark" />
            <span className="rs-spark" /><span className="rs-spark" />
          </>
        )}
      </button>
      <div className="rs-stop-label">{s.name}</div>

      {open && (
        <div className="rs-pop" onClick={(e) => e.stopPropagation()}>
          <button
            className="rs-pop-close"
            onClick={(e) => { e.stopPropagation(); onOpenToggle(s.id); }}
            title={t("close_esc")}
            aria-label={t("close_esc")}
          >
            <X size={12} />
          </button>

          <div className="rs-pop-head">
            {editing === "name" ? (
              <InlineEdit
                value={s.name}
                onSave={(v) => { onRenameStop(s.id, v); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <h5
                className="rs-editable"
                onClick={() => setEditing("name")}
                title={t("click_to_rename")}
              >
                {s.name}
              </h5>
            )}
          </div>

          <div className="rs-pop-meta">
            {editing === "date" ? (
              <InlineEdit
                type="date"
                inputClass="small"
                value={toInputDate(s.iso)}
                min={minDate ? toInputDate(minDate) : undefined}
                max={maxDate ? toInputDate(maxDate) : undefined}
                onSave={(v) => { onRescheduleStop(s.id, isoFromInput(v)); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <span
                  className="rs-editable dim"
                  onClick={() => setEditing("date")}
                  title={t("click_to_reschedule")}
                >
                  {s.dateLabel ? t("due_on", { date: s.dateLabel }) : t("no_due_date")}
                </span>
                {" · "}
                <span>{s.tasksDone}/{s.tasksAll}</span>
              </>
            )}
          </div>

          {s.tasks.map((task) => (
            <div key={task.id} className={`rs-task ${task.completed ? "done" : ""}`}>
              <span
                className="rs-chk"
                onClick={() => onTaskToggle(s.id, task.id)}
                role="checkbox"
                aria-checked={task.completed}
                tabIndex={0}
              />
              {editing && typeof editing === "object" && editing.taskId === task.id ? (
                <InlineEdit
                  value={task.title}
                  onSave={(v) => { onTaskRename(s.id, task.id, v); setEditing(null); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <span
                  className="rs-task-text"
                  onClick={() => setEditing({ taskId: task.id })}
                  title={t("click_to_rename")}
                >
                  {task.title}
                </span>
              )}
              <button
                className="rs-task-del"
                onClick={(e) => { e.stopPropagation(); onTaskDelete(s.id, task.id); }}
                title={t("task_delete")}
                aria-label={t("task_delete")}
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {!confirmDel && (
            <form className="rs-add-task" onSubmit={handleAddTask}>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={t("add_task_placeholder")}
              />
              <button type="submit" disabled={!newTask.trim()} title={t("add_task")}>
                <Plus size={12} />
              </button>
            </form>
          )}

          {!confirmDel && (
            <div className="rs-pop-actions">
              <button className="rs-pop-del" onClick={() => setConfirmDel(true)}>
                <Trash2 /> {t("milestone_delete")}
              </button>
            </div>
          )}
          {confirmDel && (
            <div className="rs-pop-confirm">
              <div className="rs-pop-confirm-text">
                {t("milestone_delete_body", { name: s.name, count: s.tasksAll })}
              </div>
              <div className="rs-pop-confirm-actions">
                <button className="text-xs px-2 py-1 rounded hover:bg-muted" onClick={() => setConfirmDel(false)}>
                  {t("cancel")}
                </button>
                <button className="rs-btn-danger" onClick={() => onDeleteStop(s.id)}>
                  {t("delete")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoadmapStrip({ orderId, projectId, initialSprints, minDate, maxDate, locale }: RoadmapStripProps) {
  const t = useTranslations("roadmap");

  // Identifies which entity the sprints/milestones belong to in API bodies
  const entityBody = orderId ? { orderId } : { projectId };

  const sortSprints = (list: SprintUI[]) => [...list].sort((a, b) => a.position - b.position);

  const [sprints, setSprints] = useState<SprintUI[]>(() => sortSprints(initialSprints));
  const [activeId, setActiveId] = useState<string | null>(() => sprints[0]?.id ?? null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  const tMsg = useCallback(
    (k: string, v?: Record<string, string | number>) => {
      try {
        return t(k, v as Parameters<typeof t>[1]);
      } catch {
        return k;
      }
    },
    [t]
  );

  const active = sprints.find((s) => s.id === activeId) ?? sprints[0] ?? null;
  const stops = useMemo<ComputedStop[]>(() => (active ? computeStops(active.milestones, locale) : []), [active, locale]);

  // Outside-click + Esc handlers
  useEffect(() => {
    if (!openMilestoneId && !showAdd && !menuId && !confirmDelId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openMilestoneId && !target.closest(".rs-stop")) setOpenMilestoneId(null);
      if (showAdd && !target.closest(".rs-add-ms-anchor")) setShowAdd(false);
      if ((menuId || confirmDelId) && !target.closest(".rs-menu-anchor")) {
        setMenuId(null);
        setConfirmDelId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMilestoneId, showAdd, menuId, confirmDelId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowAdd(false);
      setOpenMilestoneId(null);
      setMenuId(null);
      setConfirmDelId(null);
      setRenameId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const replaceSprint = (sprintId: string, updater: (s: SprintUI) => SprintUI) => {
    setSprints((prev) => prev.map((sp) => (sp.id === sprintId ? updater(sp) : sp)));
  };

  // ----- API helpers -----
  async function apiAddSprint(name: string): Promise<SprintUI | null> {
    const res = await fetch("/api/admin/sprints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...entityBody, name }),
    });
    if (!res.ok) { toast.error(tMsg("error_save")); return null; }
    const sprint = await res.json();
    return {
      id: sprint.id,
      name: sprint.name,
      position: sprint.position,
      milestones: (sprint.milestones ?? []).map(milestoneFromApi),
    };
  }

  async function apiRenameSprint(id: string, name: string) {
    const res = await fetch(`/api/admin/sprints/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) toast.error(tMsg("error_save"));
  }

  async function apiDeleteSprint(id: string) {
    const res = await fetch(`/api/admin/sprints/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error(tMsg("error_delete"));
  }

  function milestoneFromApi(m: {
    id: string;
    name: string;
    dueAt: string | null;
    completedAt: string | null;
    tasks: Array<{ id: string; title: string; completed: boolean }>;
  }): MilestoneUI {
    return {
      id: m.id,
      name: m.name,
      dueAt: m.dueAt,
      completedAt: m.completedAt,
      tasks: m.tasks.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
    };
  }

  async function apiAddMilestone(sprintId: string, name: string, dueIso: string): Promise<MilestoneUI | null> {
    const res = await fetch("/api/admin/milestones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...entityBody, sprintId, name, dueAt: dueIso }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? tMsg("error_save"));
      return null;
    }
    return milestoneFromApi(await res.json());
  }

  async function apiPatchMilestone(milestoneId: string, body: Record<string, unknown>): Promise<MilestoneUI | null> {
    const res = await fetch(`/api/admin/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? tMsg("error_save"));
      return null;
    }
    return milestoneFromApi(await res.json());
  }

  async function apiDeleteMilestone(milestoneId: string) {
    const res = await fetch(`/api/admin/milestones/${milestoneId}`, { method: "DELETE" });
    if (!res.ok) toast.error(tMsg("error_delete"));
  }

  async function apiAddTask(milestoneId: string, title: string): Promise<MilestoneTaskUI | null> {
    const res = await fetch(`/api/admin/milestones/${milestoneId}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) { toast.error(tMsg("error_save")); return null; }
    const task = await res.json();
    return { id: task.id, title: task.title, completed: task.completed };
  }

  async function apiPatchTask(milestoneId: string, taskId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/milestones/${milestoneId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) toast.error(tMsg("error_save"));
  }

  async function apiDeleteTask(milestoneId: string, taskId: string) {
    const res = await fetch(`/api/admin/milestones/${milestoneId}/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) toast.error(tMsg("error_delete"));
  }

  // ----- Handlers -----
  const handleSwitchSprint = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setOpenMilestoneId(null);
    setShowAdd(false);
  };

  const handleAddSprint = async () => {
    const idx = sprints.length + 1;
    const defaultName = tMsg("sprint_default_name", { index: idx });
    const created = await apiAddSprint(defaultName);
    if (!created) return;
    setSprints((prev) => [...prev, created]);
    setActiveId(created.id);
    setShowAdd(true);
  };

  const handleRenameSprint = async (sprintId: string, name: string) => {
    setSprints((prev) => prev.map((sp) => (sp.id === sprintId ? { ...sp, name } : sp)));
    setRenameId(null);
    await apiRenameSprint(sprintId, name);
  };

  const handleDeleteSprint = async (sprintId: string) => {
    setSprints((prev) => {
      const next = prev.filter((sp) => sp.id !== sprintId);
      if (sprintId === activeId) {
        const idx = prev.findIndex((sp) => sp.id === sprintId);
        const fallback = next[idx] ?? next[idx - 1] ?? next[0];
        if (fallback) setActiveId(fallback.id);
        else setActiveId(null);
      }
      return next;
    });
    setConfirmDelId(null);
    setOpenMilestoneId(null);
    await apiDeleteSprint(sprintId);
  };

  const handleSubmitMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !newName.trim() || !newDate) return;
    const dueIso = isoFromInput(newDate);
    const created = await apiAddMilestone(active.id, newName.trim(), dueIso);
    if (!created) return;
    replaceSprint(active.id, (sp) => ({ ...sp, milestones: [...sp.milestones, created] }));
    setNewName("");
    setNewDate("");
    setShowAdd(false);
    setOpenMilestoneId(created.id);
  };

  const handleToggleTask = async (milestoneId: string, taskId: string) => {
    if (!active) return;
    let nextCompleted = false;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const tasks = m.tasks.map((task) => {
          if (task.id !== taskId) return task;
          nextCompleted = !task.completed;
          return { ...task, completed: nextCompleted };
        });
        const allDone = tasks.length > 0 && tasks.every((task) => task.completed);
        return {
          ...m,
          tasks,
          completedAt: allDone ? new Date().toISOString() : null,
        };
      }),
    }));
    await apiPatchTask(milestoneId, taskId, { completed: nextCompleted });
  };

  const handleAddTask = async (milestoneId: string, title: string) => {
    if (!active) return;
    const task = await apiAddTask(milestoneId, title);
    if (!task) return;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) => (m.id === milestoneId ? { ...m, tasks: [...m.tasks, task] } : m)),
    }));
  };

  const handleRenameTask = async (milestoneId: string, taskId: string, title: string) => {
    if (!active) return;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map((task) => (task.id === taskId ? { ...task, title } : task)) }
          : m
      ),
    }));
    await apiPatchTask(milestoneId, taskId, { title });
  };

  const handleDeleteTask = async (milestoneId: string, taskId: string) => {
    if (!active) return;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) =>
        m.id === milestoneId ? { ...m, tasks: m.tasks.filter((task) => task.id !== taskId) } : m
      ),
    }));
    await apiDeleteTask(milestoneId, taskId);
  };

  const handleRenameStop = async (milestoneId: string, name: string) => {
    if (!active) return;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) => (m.id === milestoneId ? { ...m, name } : m)),
    }));
    await apiPatchMilestone(milestoneId, { name });
  };

  const handleRescheduleStop = async (milestoneId: string, iso: string) => {
    if (!active) return;
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.map((m) => (m.id === milestoneId ? { ...m, dueAt: iso } : m)),
    }));
    const result = await apiPatchMilestone(milestoneId, { dueAt: iso });
    if (!result) {
      // rollback by re-pulling from server is heavy; we just toast and refresh from result if available
    }
  };

  const handleDeleteStop = async (milestoneId: string) => {
    if (!active) return;
    setOpenMilestoneId(null);
    replaceSprint(active.id, (sp) => ({
      ...sp,
      milestones: sp.milestones.filter((m) => m.id !== milestoneId),
    }));
    await apiDeleteMilestone(milestoneId);
  };

  const toggleOpen = (id: string) => setOpenMilestoneId((cur) => (cur === id ? null : id));

  const totalDone = stops.filter((s) => s.state === "done").length;
  const doneWidth = stops.length === 0 ? "0%" : `calc(${(totalDone / stops.length) * 100}% + 6px)`;
  const isAllDone = stops.length > 0 && totalDone === stops.length;

  // Sprint duration in days: from earliest milestone date to latest completion/due
  const durationDays = (() => {
    if (!isAllDone || !active) return null;
    const dates = active.milestones
      .map((m) => m.dueAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    if (dates.length === 0) return null;
    const earliest = Math.min(...dates);
    const completions = active.milestones
      .map((m) => m.completedAt ?? m.dueAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    const latest = Math.max(...completions);
    const diff = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  })();

  return (
    <div className={`rs-card ${isAllDone ? "is-done" : ""}`} data-testid="roadmap-strip" data-state={isAllDone ? "done" : "active"}>
      <div className="rs-switcher" data-testid="rs-switcher">
        {sprints.map((sp, i) => (
          <SprintChip
            key={sp.id}
            sprint={sp}
            active={sp.id === (active?.id ?? "")}
            align={i < sprints.length / 2 ? "left" : "right"}
            menuOpen={menuId === sp.id}
            confirmOpen={confirmDelId === sp.id}
            renaming={renameId === sp.id}
            onClick={() => handleSwitchSprint(sp.id)}
            onMenuToggle={() => {
              setMenuId((cur) => (cur === sp.id ? null : sp.id));
              setConfirmDelId(null);
            }}
            onStartRename={() => {
              setMenuId(null);
              setRenameId(sp.id);
            }}
            onRename={(v) => handleRenameSprint(sp.id, v)}
            onCancelRename={() => setRenameId(null)}
            onAskDelete={() => {
              setMenuId(null);
              setConfirmDelId(sp.id);
            }}
            onConfirmDelete={() => handleDeleteSprint(sp.id)}
            onCancelDelete={() => setConfirmDelId(null)}
            t={tMsg}
          />
        ))}
        <button
          className="rs-add-sprint"
          type="button"
          title={tMsg("sprint_add")}
          aria-label={tMsg("sprint_add")}
          onClick={handleAddSprint}
          data-testid="rs-add-sprint"
        >
          <Plus size={14} />
        </button>
      </div>

      {active ? (
        <div className="rs-body" key={active.id} style={{ padding: "16px 22px 14px" }}>
          <div className="rs-head">
            <div className="rs-head-title">
              {isAllDone ? <Sparkles /> : <Route />}
              {isAllDone
                ? tMsg("all_done_title")
                : tMsg("header_count", { sprint: active.name, count: stops.length })}
            </div>
            {isAllDone ? (
              <div className="rs-done-actions">
                <span className="rs-done-pill">
                  <Check />
                  {tMsg("all_done_count", { done: totalDone, total: stops.length })}
                </span>
                {durationDays !== null && (
                  <span className="rs-done-pill">
                    <Clock />
                    {tMsg("all_done_duration", { days: durationDays })}
                  </span>
                )}
              </div>
            ) : (
            <div className="rs-add-ms-anchor">
              <button
                type="button"
                className={`rs-add-ms-btn ${showAdd ? "open" : ""}`}
                title={showAdd ? tMsg("cancel") : tMsg("milestone_add")}
                aria-label={tMsg("milestone_add")}
                onClick={() => setShowAdd((v) => !v)}
                data-testid="rs-add-milestone-btn"
              >
                <Plus size={14} />
              </button>
              {showAdd && (
                <div className="rs-add-ms-pop" onClick={(e) => e.stopPropagation()}>
                  <h5>{tMsg("milestone_add_in", { sprint: active.name })}</h5>
                  <form onSubmit={handleSubmitMilestone}>
                    <div className="rs-add-ms-fields">
                      <div className="rs-field">
                        <label htmlFor="rs-new-name">{tMsg("milestone_label")}<span className="req">*</span></label>
                        <input
                          id="rs-new-name"
                          autoFocus
                          placeholder={tMsg("milestone_placeholder")}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                      </div>
                      <div className="rs-field">
                        <label htmlFor="rs-new-date">{tMsg("milestone_due")}<span className="req">*</span></label>
                        <input
                          id="rs-new-date"
                          type="date"
                          required
                          min={minDate ? toInputDate(minDate) : undefined}
                          max={maxDate ? toInputDate(maxDate) : undefined}
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="rs-add-ms-actions">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setNewName(""); setNewDate(""); setShowAdd(false); }}>
                        {tMsg("cancel")}
                      </Button>
                      <Button type="submit" size="sm" disabled={!newName.trim() || !newDate}>
                        {tMsg("milestone_add_cta")}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            )}
          </div>

          {stops.length === 0 ? (
            <div className="rs-empty">
              {tMsg("empty_sprint")}{" "}
              <button
                type="button"
                className="underline hover:no-underline"
                onClick={() => setShowAdd(true)}
              >
                {tMsg("empty_sprint_cta")}
              </button>
            </div>
          ) : (
            <div className="rs-track">
              <div className="rs-line" style={isAllDone ? { background: "var(--roadmap-green)" } : undefined} />
              {!isAllDone && <div className="rs-line-done" style={{ width: doneWidth }} />}
              <div className="rs-stops">
                {stops.map((s) => (
                  <Stop
                    key={s.id}
                    s={s}
                    open={openMilestoneId === s.id}
                    onOpenToggle={toggleOpen}
                    onTaskToggle={handleToggleTask}
                    onTaskAdd={handleAddTask}
                    onTaskRename={handleRenameTask}
                    onTaskDelete={handleDeleteTask}
                    onRenameStop={handleRenameStop}
                    onRescheduleStop={handleRescheduleStop}
                    onDeleteStop={handleDeleteStop}
                    minDate={minDate ?? undefined}
                    maxDate={maxDate ?? undefined}
                    t={tMsg}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rs-empty" style={{ padding: "32px 16px" }}>
          {tMsg("empty_state")}{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={handleAddSprint}
          >
            {tMsg("empty_state_cta")}
          </button>
        </div>
      )}
    </div>
  );
}
