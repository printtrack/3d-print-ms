"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderPartData, FilamentInventory } from "./PartFileSection";
import { FILAMENT_ANY } from "./PartFileSection";
import { FilamentBadges } from "./FilamentBadges";

interface PartEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  part: OrderPartData;
  availableFilaments: FilamentInventory;
  onPartUpdated: (part: OrderPartData) => void;
}

// Wire value per axis: null (unset) | FILAMENT_ANY (egal) | concrete name
function axisFromPart(concrete: string | null, any: boolean): string | null {
  return any ? FILAMENT_ANY : concrete;
}

export function PartEditDialog({
  open,
  onOpenChange,
  orderId,
  part,
  availableFilaments,
  onPartUpdated,
}: PartEditDialogProps) {
  const [name, setName] = useState(part.name);
  const [description, setDescription] = useState(part.description ?? "");
  const [materialValue, setMaterialValue] = useState<string | null>(axisFromPart(part.material, part.materialAny));
  const [colorValue, setColorValue] = useState<string | null>(axisFromPart(part.color, part.colorAny));
  const [quantity, setQuantity] = useState(String(part.quantity ?? 1));
  const [saving, setSaving] = useState(false);

  // Reset fields whenever dialog is opened for a new part
  useEffect(() => {
    if (open) {
      setName(part.name);
      setDescription(part.description ?? "");
      setMaterialValue(axisFromPart(part.material, part.materialAny));
      setColorValue(axisFromPart(part.color, part.colorAny));
      setQuantity(String(part.quantity ?? 1));
    }
  }, [open, part]);

  const materialConcrete = materialValue && materialValue !== FILAMENT_ANY ? materialValue : null;
  const colorConcrete = colorValue && colorValue !== FILAMENT_ANY ? colorValue : null;
  const colorHex = colorConcrete
    ? availableFilaments.colors.find(
        (c) => (!materialConcrete || c.material === materialConcrete) && c.color === colorConcrete
      )?.colorHex ?? null
    : null;

  function handleMaterialChange(value: string | null) {
    setMaterialValue(value);
    // Reset an incompatible concrete color when switching to a concrete material.
    if (value && value !== FILAMENT_ANY && colorConcrete) {
      const stillValid = availableFilaments.colors.some((c) => c.material === value && c.color === colorConcrete);
      if (!stillValid) setColorValue(null);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/parts/${part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          material: materialValue,
          color: colorValue,
          quantity: parseInt(quantity, 10) || 1,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onPartUpdated(updated);
      toast.success("Teil aktualisiert");
      onOpenChange(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teil bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="part-edit-name">Name *</Label>
            <Input
              id="part-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Teilname"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="part-edit-desc">Beschreibung</Label>
            <Textarea
              id="part-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="part-edit-qty">Anzahl</Label>
            <Input
              id="part-edit-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Filament</Label>
            <FilamentBadges
              material={materialConcrete}
              materialAny={materialValue === FILAMENT_ANY}
              color={colorConcrete}
              colorAny={colorValue === FILAMENT_ANY}
              colorHex={colorHex}
              inventory={availableFilaments}
              estGrams={part.gramsEstimated}
              onMaterialChange={handleMaterialChange}
              onColorChange={setColorValue}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
