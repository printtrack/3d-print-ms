"use client";

import { Asterisk, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILAMENT_ANY, type FilamentInventory } from "./PartFileSection";

interface FilamentBadgesProps {
  material: string | null;
  materialAny: boolean;
  color: string | null;
  colorAny: boolean;
  colorHex: string | null;
  inventory: FilamentInventory;
  estGrams?: number | null;
  /** null = unset, FILAMENT_ANY = egal, otherwise a concrete value */
  onMaterialChange: (value: string | null) => void;
  onColorChange: (value: string | null) => void;
}

function stockClass(g: number): string {
  return g < 0 ? "text-destructive font-medium" : g === 0 ? "text-muted-foreground" : g < 250 ? "text-amber-600" : "text-muted-foreground";
}

export function FilamentBadges({
  material,
  materialAny,
  color,
  colorAny,
  colorHex,
  inventory,
  estGrams,
  onMaterialChange,
  onColorChange,
}: FilamentBadgesProps) {
  const t = useTranslations("admin");
  const colors = inventory.colors;
  const materials = [...new Set(colors.map((c) => c.material))].sort();
  const colorsFor = (m: string) => colors.filter((c) => c.material === m);
  const inStockCount = (m: string) => colorsFor(m).filter((c) => c.availableGrams > 0).length;
  const stockKg = (m: string) => colorsFor(m).reduce((s, c) => s + Math.max(0, c.availableGrams), 0) / 1000;

  // Colors aggregated across all materials, for material = "egal".
  const anyColors = () => {
    const byName = new Map<string, { color: string; colorHex: string | null; availableGrams: number; mats: Set<string> }>();
    for (const c of colors) {
      const o = byName.get(c.color) ?? { color: c.color, colorHex: c.colorHex, availableGrams: 0, mats: new Set<string>() };
      if (c.availableGrams > 0) {
        o.availableGrams += c.availableGrams;
        o.mats.add(c.material);
      }
      if (!o.colorHex && c.colorHex) o.colorHex = c.colorHex;
      byName.set(c.color, o);
    }
    return [...byName.values()].sort((a, b) => b.availableGrams - a.availableGrams);
  };

  const materialSet = materialAny || !!material;
  const materialLabel = materialAny ? t("part_material_any") : material ?? t("part_material");
  const colorLabel = colorAny ? t("part_color_any") : color ?? t("part_color");

  const colorList = materialAny
    ? anyColors().map((c) => ({ color: c.color, colorHex: c.colorHex, availableGrams: c.availableGrams, matCount: c.mats.size }))
    : material
    ? colorsFor(material).map((c) => ({ color: c.color, colorHex: c.colorHex, availableGrams: c.availableGrams, matCount: 1 }))
    : [];

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {/* Material badge */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-tutorial="filament-btn"
            className={cn(
              "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium transition-colors",
              materialSet
                ? "border-border bg-background hover:bg-accent text-foreground font-mono"
                : "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
            )}
            title={t("part_material")}
          >
            {materialAny && <Asterisk className="h-3 w-3 opacity-60" />}
            {materialLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-tutorial="filament-dropdown" align="start" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("part_material")}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => onMaterialChange(materialAny ? null : FILAMENT_ANY)}
            className={cn("gap-2", materialAny && "bg-accent")}
          >
            <Asterisk className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1">
              {t("part_egal")}
              <span className="block text-[10px] text-muted-foreground">{t("part_material_open")}</span>
            </span>
            {materialAny && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {materials.map((m) => {
            const empty = inStockCount(m) === 0;
            return (
              <DropdownMenuItem
                key={m}
                disabled={empty}
                onClick={() => onMaterialChange(m)}
                className={cn("gap-2", material === m && "bg-accent")}
              >
                <span className="w-4 h-4 rounded bg-secondary text-[8px] font-bold font-mono text-muted-foreground flex items-center justify-center shrink-0">
                  {m.slice(0, 2)}
                </span>
                <span className="flex-1">
                  {m}
                  <span className={cn("block text-[10px]", empty ? "text-muted-foreground" : "text-muted-foreground")}>
                    {empty ? t("part_no_stock") : `${inStockCount(m)} · ${stockKg(m).toFixed(1)} kg`}
                  </span>
                </span>
                {material === m && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Color badge — disabled until a material choice exists */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!materialSet}>
          <button
            type="button"
            disabled={!materialSet}
            className={cn(
              "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              colorAny || color
                ? "border-border bg-background hover:bg-accent text-foreground"
                : "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
            )}
            title={t("part_color")}
          >
            {colorAny ? (
              <Asterisk className="h-3 w-3 opacity-60" />
            ) : color && colorHex ? (
              <span className="w-2.5 h-2.5 rounded-full border border-border shrink-0" style={{ backgroundColor: colorHex }} />
            ) : null}
            {colorLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {materialAny ? t("part_color_over_all") : t("part_color_for", { material: material ?? "" })}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => onColorChange(colorAny ? null : FILAMENT_ANY)}
            className={cn("gap-2", colorAny && "bg-accent")}
          >
            <Asterisk className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1">
              {t("part_egal")}
              <span className="block text-[10px] text-muted-foreground">{t("part_color_open")}</span>
            </span>
            {colorAny && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {colorList.map((c) => {
            const empty = c.availableGrams <= 0;
            const short = estGrams != null && c.availableGrams > 0 && c.availableGrams < estGrams;
            const sub = materialAny
              ? empty
                ? t("part_empty")
                : `${c.availableGrams} g · ${c.matCount}×`
              : empty
              ? t("part_not_in_stock")
              : `${c.availableGrams} g${short ? ` · ${t("part_low")}` : ""}`;
            return (
              <DropdownMenuItem
                key={c.color}
                disabled={empty}
                onClick={() => onColorChange(c.color)}
                className={cn("gap-2", color === c.color && "bg-accent")}
              >
                <span
                  className="w-4 h-4 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: c.colorHex ?? "transparent" }}
                />
                <span className="flex-1 truncate">
                  {c.color}
                  <span className={cn("block text-[10px]", stockClass(c.availableGrams))}>{sub}</span>
                </span>
                {color === c.color && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
