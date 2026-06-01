"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Archive,
  ChevronDown,
  FlaskConical,
  GripVertical,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { OrderConditionEditor } from "./PhaseConditionEditor";
import {
  parseOrderConditions,
  type OrderCondition,
} from "@/lib/phase-conditions";

interface Phase {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSurvey: boolean;
  isPrototype: boolean;
  isArchive: boolean;
  enterGate?: unknown;
  autoAdvance?: unknown;
  _count: { orders: number };
}

function SortablePhaseRow({
  phase,
  onEdit,
  onDelete,
}: {
  phase: Phase;
  onEdit: (phase: Phase) => void;
  onDelete: (phase: Phase) => void;
}) {
  const t = useTranslations("admin");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const gateCount = parseOrderConditions(phase.enterGate as Parameters<typeof parseOrderConditions>[0]).length;
  const autoCount = parseOrderConditions(phase.autoAdvance as Parameters<typeof parseOrderConditions>[0]).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg"
      data-testid="phase-row"
      data-phase-node={phase.id}
      id={`phase-node-${phase.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: phase.color }}
      />

      <span className="flex-1 min-w-0 font-medium text-sm truncate">{phase.name}</span>

      {phase.isDefault && (
        <Badge variant="secondary" className="text-xs shrink-0">
          <Star className="h-3 w-3 mr-1" />
          {t("phase_badge_standard")}
        </Badge>
      )}

      {phase.isSurvey && (
        <Badge variant="secondary" className="text-xs shrink-0">
          <MessageSquare className="h-3 w-3 mr-1" />
          {t("phase_badge_survey")}
        </Badge>
      )}

      {phase.isPrototype && (
        <Badge className="text-xs shrink-0 bg-purple-100 text-purple-700 hover:bg-purple-100">
          <FlaskConical className="h-3 w-3 mr-1" />
          {t("phase_badge_prototype")}
        </Badge>
      )}

      {phase.isArchive && (
        <Badge className="text-xs shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-100">
          <Archive className="h-3 w-3 mr-1" />
          {t("phase_badge_archive")}
        </Badge>
      )}

      {gateCount > 0 && (
        <Badge className="text-xs shrink-0 bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Lock className="h-3 w-3 mr-1" />
          {t("phase_flow_gate_label")} · {gateCount}
        </Badge>
      )}

      {autoCount > 0 && (
        <Badge className="text-xs shrink-0 bg-primary/10 text-primary hover:bg-primary/10">
          <Zap className="h-3 w-3 mr-1" />
          {t("phase_flow_auto_label")} · {autoCount}
        </Badge>
      )}

      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">{phase._count.orders} {t("phase_badge_orders")}</span>

      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(phase)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(phase)}
          disabled={phase._count.orders > 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface FormData {
  name: string;
  color: string;
  isDefault: boolean;
  isSurvey: boolean;
  isPrototype: boolean;
  isArchive: boolean;
  enterGate: OrderCondition[];
  autoAdvance: OrderCondition[];
}

const EMPTY_FORM: FormData = {
  name: "",
  color: "#6366f1",
  isDefault: false,
  isSurvey: false,
  isPrototype: false,
  isArchive: false,
  enterGate: [],
  autoAdvance: [],
};

export function PhaseManager({ initialPhases }: { initialPhases: Phase[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [phases, setPhases] = useState(initialPhases);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/phases")
      .then((r) => r.json())
      .then((fresh) => setPhases(fresh))
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function openCreate() {
    setFormData(EMPTY_FORM);
    setEditingPhase(null);
    setActiveTab("general");
    setIsCreating(true);
  }

  function openEdit(phase: Phase) {
    setFormData({
      name: phase.name,
      color: phase.color,
      isDefault: phase.isDefault,
      isSurvey: phase.isSurvey,
      isPrototype: phase.isPrototype,
      isArchive: phase.isArchive,
      enterGate: parseOrderConditions(phase.enterGate as Parameters<typeof parseOrderConditions>[0]),
      autoAdvance: parseOrderConditions(phase.autoAdvance as Parameters<typeof parseOrderConditions>[0]),
    });
    setEditingPhase(phase);
    setActiveTab("general");
    setIsCreating(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error(t("phase_name_required"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        color: formData.color,
        isDefault: formData.isDefault,
        isSurvey: formData.isSurvey,
        isPrototype: formData.isPrototype,
        isArchive: formData.isArchive,
        enterGate: formData.enterGate,
        autoAdvance: formData.autoAdvance,
      };
      if (editingPhase) {
        const res = await fetch(`/api/admin/phases/${editingPhase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setPhases((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, ...updated, _count: p._count } : p))
        );
        toast.success(t("phase_updated"));
      } else {
        const res = await fetch("/api/admin/phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setPhases((prev) => [...prev, { ...created, _count: { orders: 0 } }]);
        toast.success(t("phase_created"));
      }
      setIsCreating(false);
    } catch {
      toast.error(t("phase_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(phase: Phase) {
    if (!confirm(t("phase_delete_confirm", { name: phase.name }))) return;

    try {
      const res = await fetch(`/api/admin/phases/${phase.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      setPhases((prev) => prev.filter((p) => p.id !== phase.id));
      toast.success(t("phase_deleted"));
    } catch {
      toast.error(t("phase_delete_failed"));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
      ...p,
      position: i,
    }));

    setPhases(reordered);

    try {
      await Promise.all(
        reordered.map((phase) =>
          fetch(`/api/admin/phases/${phase.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: phase.position }),
          })
        )
      );
    } catch {
      toast.error(t("phase_order_failed"));
    }
  }

  const sortedPhases = [...phases].sort((a, b) => a.position - b.position);
  const editingIdx = editingPhase ? sortedPhases.findIndex((p) => p.id === editingPhase.id) : -1;
  const editingIsLast = editingIdx === sortedPhases.length - 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("phase_manager_title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("phase_manager_desc")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("phase_manager_add")}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0" data-testid="phase-flow-diagram">
            {sortedPhases.map((phase, idx) => {
              const isLast = idx === sortedPhases.length - 1;
              const autoCount = parseOrderConditions(
                phase.autoAdvance as Parameters<typeof parseOrderConditions>[0]
              ).length;
              return (
                <div key={phase.id} className="space-y-0">
                  <SortablePhaseRow
                    phase={phase}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                  {!isLast && (
                    <div
                      className="flex h-6 items-center pl-7"
                      data-testid={`phase-connector-${phase.id}`}
                      aria-hidden="true"
                    >
                      {autoCount > 0 ? (
                        <span className="flex items-center gap-1.5 text-primary">
                          <ChevronDown
                            className="h-4 w-4 animate-pulse"
                            strokeWidth={2.5}
                          />
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Zap className="h-2.5 w-2.5" />
                            {t("phase_flow_auto_label")} · {autoCount}
                          </span>
                        </span>
                      ) : (
                        <ChevronDown
                          className="h-4 w-4 text-muted-foreground/40"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {phases.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t("phase_manager_empty")}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPhase ? t("phase_dialog_edit") : t("phase_dialog_new")}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">{t("phase_tab_general")}</TabsTrigger>
              <TabsTrigger value="gate" data-testid="phase-tab-gate">
                {t("phase_tab_gate")}
                {formData.enterGate.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
                    {formData.enterGate.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="auto" data-testid="phase-tab-auto">
                {t("phase_tab_auto_advance")}
                {formData.autoAdvance.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                    {formData.autoAdvance.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="phase-name">{tc("name")} *</Label>
                <Input
                  id="phase-name"
                  placeholder={t("phase_name_placeholder")}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phase-color">{tc("color")}</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="phase-color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    placeholder="#6366f1"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-default"
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is-default">{t("phase_is_default")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-survey"
                  type="checkbox"
                  checked={formData.isSurvey}
                  onChange={(e) => setFormData((p) => ({ ...p, isSurvey: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is-survey">{t("phase_is_survey")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-prototype"
                  type="checkbox"
                  checked={formData.isPrototype}
                  onChange={(e) => setFormData((p) => ({ ...p, isPrototype: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is-prototype">{t("phase_is_prototype")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-archive"
                  type="checkbox"
                  checked={formData.isArchive}
                  onChange={(e) => setFormData((p) => ({ ...p, isArchive: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is-archive">{t("phase_is_archive")}</Label>
              </div>
            </TabsContent>

            <TabsContent value="gate" className="space-y-3 py-3">
              <p className="text-sm text-muted-foreground">{t("phase_gate_hint")}</p>
              <OrderConditionEditor
                value={formData.enterGate}
                onChange={(next) => setFormData((p) => ({ ...p, enterGate: next }))}
                testidPrefix="gate"
              />
            </TabsContent>

            <TabsContent value="auto" className="space-y-3 py-3">
              <p className="text-sm text-muted-foreground">{t("phase_auto_advance_hint")}</p>
              {editingPhase && editingIsLast && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t("phase_no_next_phase_warning")}
                </p>
              )}
              <OrderConditionEditor
                value={formData.autoAdvance}
                onChange={(next) => setFormData((p) => ({ ...p, autoAdvance: next }))}
                testidPrefix="auto"
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="phase-save-btn">
              {saving ? `${tc("save")}...` : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
