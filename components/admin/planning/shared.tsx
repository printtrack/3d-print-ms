"use client";

import { useLocale } from "next-intl";
import { cn, localeToDateLocale } from "@/lib/utils";
import { initials } from "@/lib/gantt-utils";
import type { PlanEntry } from "@/lib/planning-entries";

export type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Locale-aware month / weekday names for the calendar chrome. */
export function useDateNames() {
  const locale = useLocale();
  const dl = localeToDateLocale(locale);
  const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(dl, opts).format(d);
  return {
    dateLocale: dl,
    monthLong: (m: number) => fmt({ month: "long" }, new Date(2020, m, 1)),
    monthShort: (m: number) => fmt({ month: "short" }, new Date(2020, m, 1)),
    weekdayShort: (d: Date) => fmt({ weekday: "short" }, d),
    weekdayLong: (d: Date) => fmt({ weekday: "long" }, d),
    weekdayNarrow: (d: Date) => fmt({ weekday: "narrow" }, d),
    fullDate: (d: Date) => fmt({ day: "numeric", month: "long", year: "numeric" }, d),
  };
}

/** Relative-day label ("in 3 days" / "2 days overdue"), localised via t(). */
export function formatRel(diff: number, t: Translator): string {
  if (diff === 0) return t("planning_rel_today");
  if (diff === 1) return t("planning_rel_tomorrow");
  if (diff === -1) return t("planning_rel_overdue_one");
  if (diff < 0) return t("planning_rel_overdue", { count: -diff });
  return t("planning_rel_in", { count: diff });
}

/** brand accent used for "today" tints across the planning views */
export const BRAND = "var(--brand-accent)";
export const BRAND_DIM = "var(--brand-accent-dim)";
export const BRAND_SOFT = "color-mix(in oklab, var(--brand-accent) 8%, transparent)";

/** hex + alpha → rgba() (design helper, kept for bar tints) */
export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Small round initials badge (team member). */
export function PlanAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0 ring-1 ring-border/60",
        size === "sm" ? "h-[22px] w-[22px] text-[10px]" : "h-7 w-7 text-[11px]"
      )}
      style={{ background: BRAND_SOFT, color: BRAND_DIM }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/** Phase pill used in agenda + detail panel. */
export function PhaseBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
      style={{ background: hexA(color, 0.14), color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

/** Bar fill/border styling shared by timeline + month bars. */
export function barColors(e: PlanEntry) {
  if (e.overdue) {
    return { background: hexA("#ef4444", 0.13), borderColor: hexA("#ef4444", 0.45), accent: "#ef4444" };
  }
  if (e.done) {
    return { background: "var(--muted)", borderColor: "var(--border)", accent: "var(--muted-foreground)" };
  }
  return { background: hexA(e.color, 0.16), borderColor: hexA(e.color, 0.42), accent: e.color };
}

export { cn };
