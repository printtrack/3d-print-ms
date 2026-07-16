// Shared section chrome for landing blocks.
//
// The hardcoded page alternated white / muted backgrounds by hand and always
// knew its own text colors. Blocks are sortable and their background is an
// admin choice, so both have to be derived from one value — otherwise a section
// switched to `dark` keeps gray-900 headlines and goes unreadable.
//
// The values here reproduce app/page.tsx exactly (white sections were `bg-white`,
// the "How it works" band was the inline oklch below, the hero used
// --landing-hero-bg), which is what keeps the visual snapshot green.

import type { CSSProperties } from "react";
import type { Background, IconTone } from "@/lib/landing/blocks";
import type { Locale } from "@/i18n/locale";

/**
 * What every block renderer receives.
 *
 * `blockId` and `editing` exist for inline editing: the id tags the section so a
 * click can select it in the editor, and `editing` turns the copy into
 * contentEditable spans. Both are inert on the public page.
 */
export interface BlockProps<T> {
  data: T;
  locale: Locale;
  blockId: string;
  editing: boolean;
}

const MUTED_BG = "oklch(0.97 0.004 240)";

export function sectionBackground(bg: Background): {
  className: string;
  style: CSSProperties;
} {
  if (bg === "dark") return { className: "", style: { backgroundColor: "var(--landing-hero-bg)" } };
  if (bg === "muted") return { className: "", style: { backgroundColor: MUTED_BG } };
  return { className: "bg-white", style: {} };
}

/**
 * Icon tone → the two colours it drives: the glyph and the tile behind it.
 *
 * Every value resolves through --landing-accent / --brand-accent or a neutral,
 * so changing Settings → Marke moves all of them at once. Nothing here is a
 * second brand colour (DESIGN.md); they are shades of the one there is.
 */
export function iconToneStyle(tone: IconTone): { color: string; tile: string } {
  switch (tone) {
    case "accent-dim":
      return {
        color: "var(--landing-accent-dim)",
        tile: "color-mix(in oklab, var(--brand-accent-dim) 22%, transparent)",
      };
    case "accent-soft":
      return {
        color: "color-mix(in oklab, var(--brand-accent) 65%, white)",
        tile: "color-mix(in oklab, var(--brand-accent) 12%, transparent)",
      };
    case "neutral":
      return { color: "oklch(0.55 0.01 260)", tile: "oklch(0.93 0.004 260)" };
    case "light":
      return { color: "oklch(1 0 0 / 85%)", tile: "oklch(1 0 0 / 12%)" };
    case "dark":
      return { color: "var(--landing-hero-bg)", tile: "oklch(0.90 0.004 260)" };
    case "accent":
    default:
      return { color: "var(--landing-accent)", tile: "var(--landing-accent-glow)" };
  }
}

/** Text colors that stay legible on the chosen background. */
export function tone(bg: Background) {
  const dark = bg === "dark";
  return {
    dark,
    /** Section headline (DM Serif). */
    headline: dark ? "text-white" : "text-gray-900",
    /** Card / item title. */
    title: dark ? "text-white" : "text-gray-900",
    /** Body copy. */
    body: dark ? "" : "text-gray-500",
    bodyStyle: (dark ? { color: "oklch(1 0 0 / 60%)" } : {}) as CSSProperties,
    /** Card surface on a dark band. */
    cardBorder: dark ? "border-white/10" : "border-gray-100",
  };
}
