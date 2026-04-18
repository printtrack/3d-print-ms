"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderPartData, FilamentOption } from "./PartFileSection";

const NONE = "__none__";

interface PartEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  part: OrderPartData;
  availableFilaments: FilamentOption[];
  onPartUpdated: (part: OrderPartData) => void;
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
  const [filamentId, setFilamentId] = useState(part.filamentId ?? NONE);
  const [quantity, setQuantity] = useState(String(part.quantity ?? 1));
  const [saving, setSaving] = useState(false);

  // Reset fields whenever dialog is opened for a new part
  useEffect(() => {
    if (open) {
      setName(part.name);
      setDescription(part.description ?? "");
      setFilamentId(part.filamentId ?? NONE);
      setQuantity(String(part.quantity ?? 1));
    }
  }, [open, part]);

  const materials = Array.from(new Set(availableFilaments.map((f) => f.material))).sort();

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
          filamentId: filamentId === NONE ? null : filamentId,
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
            <Select value={filamentId} onValueChange={setFilamentId}>
              <SelectTrigger>
                <SelectValue placeholder="Kein Filament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Kein Filament</SelectItem>
                {materials.map((mat) => (
                  <SelectGroup key={mat}>
                    <SelectLabel>{mat}</SelectLabel>
                    {availableFilaments
                      .filter((f) => f.material === mat)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          <span className="flex items-center gap-2">
                            {f.colorHex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-border"
                                style={{ backgroundColor: f.colorHex }}
                              />
                            )}
                            {f.name} ({f.remainingGrams} g)
                          </span>
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
