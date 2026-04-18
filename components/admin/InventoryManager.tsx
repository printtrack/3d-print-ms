"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from "lucide-react";

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "Nylon", "PC", "Other"] as const;
type Material = (typeof MATERIALS)[number];

interface Filament {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string | null;
  brand: string | null;
  spoolWeightGrams: number;
  remainingGrams: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { orderParts: number };
}

interface InventoryManagerProps {
  filaments: Filament[];
  userRole: string;
}

const emptyForm = {
  name: "",
  material: "PLA" as Material,
  color: "",
  colorHex: "#000000",
  brand: "",
  spoolWeightGrams: 1000,
  remainingGrams: 1000,
  notes: "",
  isActive: true,
};

export function InventoryManager({ filaments: initial, userRole }: InventoryManagerProps) {
  const isAdmin = userRole === "ADMIN";
  const [filaments, setFilaments] = useState(initial);
  const [filterMaterial, setFilterMaterial] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFilament, setEditingFilament] = useState<Filament | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return filaments.filter((f) => {
      if (!showInactive && !f.isActive) return false;
      if (filterMaterial !== "all" && f.material !== filterMaterial) return false;
      return true;
    });
  }, [filaments, filterMaterial, showInactive]);

  function openAdd() {
    setEditingFilament(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(f: Filament) {
    setEditingFilament(f);
    setForm({
      name: f.name,
      material: f.material as Material,
      color: f.color,
      colorHex: f.colorHex ?? "#000000",
      brand: f.brand ?? "",
      spoolWeightGrams: f.spoolWeightGrams,
      remainingGrams: f.remainingGrams,
      notes: f.notes ?? "",
      isActive: f.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.color.trim()) {
      toast.error("Name und Farbe sind Pflichtfelder");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        material: form.material,
        color: form.color.trim(),
        colorHex: form.colorHex || null,
        brand: form.brand.trim() || null,
        spoolWeightGrams: Number(form.spoolWeightGrams),
        remainingGrams: Number(form.remainingGrams),
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      };

      let res: Response;
      if (editingFilament) {
        res = await fetch(`/api/admin/inventory/${editingFilament.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error();
      const updated: Filament = await res.json();

      if (editingFilament) {
        setFilaments((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        toast.success("Filament aktualisiert");
      } else {
        setFilaments((prev) => [...prev, updated]);
        toast.success("Filament hinzugefügt");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: Filament) {
    if (!confirm(`Filament "${f.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/inventory/${f.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      if (!res.ok) throw new Error();
      setFilaments((prev) => prev.filter((x) => x.id !== f.id));
      toast.success("Filament gelöscht");
    } catch {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Inventar</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterMaterial} onValueChange={setFilterMaterial}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Materialien</SelectItem>
              {MATERIALS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Inaktive anzeigen
          </label>

          {isAdmin && (
            <Button onClick={openAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Filament hinzufügen
            </Button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Keine Filamente gefunden</p>
        )}
        {filtered.map((f) => (
          <div
            key={f.id}
            className={`rounded-lg border bg-card p-4 space-y-2${!f.isActive ? " opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: f.colorHex ?? "#ccc" }}
                  aria-label={`Farbe: ${f.color}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    {f.name}
                    {f.remainingGrams < 250 && f.isActive && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Wenig Bestand" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.color} · {f.material}{f.brand ? ` · ${f.brand}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {f.isActive ? (
                  <Badge variant="default" className="text-xs">Aktiv</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Inaktiv</Badge>
                )}
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)} aria-label={`${f.name} bearbeiten`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(f)}
                      aria-label={`${f.name} löschen`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Bestand:{" "}
                <span className={f.remainingGrams < 250 ? "text-amber-600 font-medium" : "text-foreground"}>
                  {f.remainingGrams} g
                </span>{" "}
                / {f.spoolWeightGrams} g
              </span>
              <span>Aufträge: {f._count.orderParts}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-10 px-4 text-left font-medium text-muted-foreground w-10">Farbe</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Name</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Material</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Marke</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Bestand</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Aufträge</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Status</th>
              {isAdmin && <th className="h-10 px-4 text-left font-medium text-muted-foreground w-20">Aktionen</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-10 px-4">
                  Keine Filamente gefunden
                </td>
              </tr>
            )}
            {filtered.map((f) => (
              <tr key={f.id} className={`border-b last:border-0 hover:bg-muted/30${!f.isActive ? " opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div
                    className="w-6 h-6 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: f.colorHex ?? "#ccc" }}
                    title={f.color}
                  />
                </td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    {f.name}
                    {f.remainingGrams < 250 && f.isActive && (
                      <span title="Wenig Bestand"><AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /></span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">{f.color}</div>
                </td>
                <td className="px-4 py-3">{f.material}</td>
                <td className="px-4 py-3">{f.brand ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={f.remainingGrams < 250 ? "text-amber-600 font-medium" : undefined}>
                      {f.remainingGrams} g
                    </span>
                    <span className="text-xs text-muted-foreground">/ {f.spoolWeightGrams} g</span>
                  </div>
                </td>
                <td className="px-4 py-3">{f._count.orderParts}</td>
                <td className="px-4 py-3">
                  {f.isActive ? (
                    <Badge variant="default" className="text-xs">Aktiv</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inaktiv</Badge>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)} aria-label={`${f.name} bearbeiten`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(f)}
                        aria-label={`${f.name} löschen`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFilament ? "Filament bearbeiten" : "Filament hinzufügen"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="z.B. PLA Basic Weiß"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material *</label>
              <Select
                value={form.material}
                onValueChange={(v) => setForm((p) => ({ ...p, material: v as Material }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Farbe *</label>
                <Input
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  placeholder="z.B. Weiß"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Farbcode</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                    className="h-9 w-14 rounded-md border border-input cursor-pointer p-0.5"
                  />
                  <span className="text-sm text-muted-foreground font-mono">{form.colorHex}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Marke</label>
              <Input
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="z.B. Prusament"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Spulengewicht (g) *</label>
                <Input
                  type="number"
                  min="1"
                  value={form.spoolWeightGrams}
                  onChange={(e) => setForm((p) => ({ ...p, spoolWeightGrams: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Verbleibend (g) *</label>
                <Input
                  type="number"
                  min="0"
                  value={form.remainingGrams}
                  onChange={(e) => setForm((p) => ({ ...p, remainingGrams: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notizen</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Optionale Notizen..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded"
              />
              Aktiv
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
