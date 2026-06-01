"use client";

import { Printer, PencilRuler, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type OrderType = "PRINT_ONLY" | "DESIGN";

// Single brand accent (amber) — see DESIGN.md. Applied inline since there is no
// global utility class for it (same approach as PhaseChip / DeadlineChip).
const ACCENT = "oklch(0.72 0.18 55)";

const OPTIONS: Array<{
  value: OrderType;
  icon: typeof Printer;
  labelKey: "print_only_label" | "design_label";
  descKey: "print_only_desc" | "design_desc";
}> = [
  { value: "PRINT_ONLY", icon: Printer, labelKey: "print_only_label", descKey: "print_only_desc" },
  { value: "DESIGN", icon: PencilRuler, labelKey: "design_label", descKey: "design_desc" },
];

interface Props {
  value: OrderType;
  onChange: (value: OrderType) => void;
}

export function OrderTypeField({ value, onChange }: Props) {
  const t = useTranslations("order_type");

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium leading-none">{t("type_question")}</span>
      <div role="radiogroup" aria-label={t("type_question")} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                "group relative flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                selected
                  ? "shadow-[0_1px_0_oklch(0.72_0.18_55_/_12%)_inset,0_2px_10px_oklch(0.72_0.18_55_/_10%)]"
                  : "border-border hover:border-foreground/25 hover:bg-accent/40"
              )}
              style={
                selected
                  ? { borderColor: ACCENT, background: "oklch(0.72 0.18 55 / 7%)" }
                  : undefined
              }
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
                  selected ? "text-background" : "border-border bg-muted/50 text-muted-foreground"
                )}
                style={selected ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold leading-tight">{t(opt.labelKey)}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {t(opt.descKey)}
                </span>
              </span>
              <span
                className={cn(
                  "absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full transition-opacity",
                  selected ? "opacity-100" : "opacity-0"
                )}
                style={selected ? { background: ACCENT, color: "white" } : undefined}
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
