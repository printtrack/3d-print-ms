// Single source of truth for what a landing page can be built from.
//
// Every section of the public landing page is a `LandingBlock` row: a `type`
// from the registry below plus a `data` JSON validated by that type's schema.
// Admins reorder, hide, add and edit them in /admin/landing.
//
// This module is deliberately free of prisma/next imports — the editor forms are
// client components and need BLOCK_DEFS as a *value* to render themselves, the
// same way RoleManager.tsx consumes lib/permissions.ts. The DB wrapper lives in
// lib/landing/page.ts, the seed content in lib/landing/defaults.ts.
//
// Localized copy lives INSIDE data as { de, en }. Image paths and layout choices
// stay plain values, so they cannot drift apart between the two languages.

import { z } from "zod";
import type { Locale } from "@/i18n/locale";

// ---------------------------------------------------------------------------
// Localized strings
// ---------------------------------------------------------------------------

export const localized = z.object({
  de: z.string(),
  en: z.string().default(""),
});

export type Localized = z.infer<typeof localized>;

/** Empty English falls back to German — an admin may leave EN blank. */
export function pick(value: Localized | undefined, locale: Locale): string {
  if (!value) return "";
  return (locale === "en" ? value.en : value.de) || value.de;
}

export function emptyLocalized(): Localized {
  return { de: "", en: "" };
}

// ---------------------------------------------------------------------------
// Shared field vocabulary
// ---------------------------------------------------------------------------

/**
 * Section background. The hardcoded page alternated white / muted by position;
 * once blocks are freely sortable that has to become an explicit, editable
 * choice. `dark` uses --landing-hero-bg.
 */
export const background = z.enum(["white", "muted", "dark"]);
export type Background = z.infer<typeof background>;
export const BACKGROUNDS: Background[] = ["white", "muted", "dark"];

/**
 * Icons offered in the editor. A closed set, not "any lucide name": the renderer
 * maps these to imported components, and an unknown string would crash it.
 * Keep in sync with BLOCK_ICONS in components/landing/blocks/icons.ts.
 */
export const FEATURE_ICON_NAMES = [
  "Zap",
  "Shield",
  "Eye",
  "MessageCircle",
  "Printer",
  "Clock",
  "Package",
  "Sparkles",
  "Users",
  "Wrench",
  "Leaf",
  "Award",
] as const;

export const featureIcon = z.enum(FEATURE_ICON_NAMES);
export type FeatureIconName = z.infer<typeof featureIcon>;

/**
 * Icon colouring — a closed set of tones *derived from the brand accent*, not a
 * free colour picker.
 *
 * DESIGN.md: "Do not introduce a second, hardcoded brand color … the single
 * accent is var(--brand-accent)." A colour well per icon would break that and,
 * worse, break white-labelling: an admin who later changes Settings → Marke
 * would find icons still wearing the old brand. Every tone below resolves
 * through --landing-accent / --brand-accent, so they all follow that switch.
 *
 * Resolved to actual CSS in components/landing/blocks/section.tsx.
 */
export const ICON_TONES = [
  "accent",
  "accent-dim",
  "accent-soft",
  "neutral",
  "light",
  "dark",
] as const;

export const iconTone = z.enum(ICON_TONES);
export type IconTone = z.infer<typeof iconTone>;

/** Uploaded via /api/admin/uploads/landing, always served through /api/files. */
const imagePath = z.string();

// ---------------------------------------------------------------------------
// Block schemas
// ---------------------------------------------------------------------------

const base = { background: background.default("white") };

export const heroSchema = z.object({
  ...base,
  background: background.default("dark"),
  eyebrow: localized,
  headline1: localized,
  headline2: localized,
  subheadline: localized,
  ctaLabel: localized,
  ctaHref: z.string().default("#order-form"),
});

export const featuresSchema = z.object({
  ...base,
  label: localized,
  headline: localized,
  items: z
    .array(
      z.object({
        icon: featureIcon,
        // Older rows predate the tone field; default keeps them on the accent,
        // which is exactly what they rendered before.
        tone: iconTone.default("accent"),
        title: localized,
        description: localized,
      }),
    )
    .min(1)
    .max(8),
});

export const stepsSchema = z.object({
  ...base,
  background: background.default("muted"),
  label: localized,
  headline: localized,
  items: z
    .array(
      z.object({
        number: z.string(),
        title: localized,
        description: localized,
      }),
    )
    .min(1)
    .max(6),
});

export const orderFormSchema = z.object({
  ...base,
  label: localized,
  headline: localized,
  subheadline: localized,
});

export const richtextSchema = z.object({
  ...base,
  label: localized,
  headline: localized,
  // Markdown, rendered with react-markdown WITHOUT rehype-raw — raw HTML stays
  // inert, so no sanitizer is needed on a field an admin can fill freely.
  body: localized,
});

export const imageSchema = z.object({
  ...base,
  image: imagePath,
  alt: localized,
  caption: localized,
  width: z.enum(["narrow", "wide", "full"]).default("wide"),
});

export const textImageSchema = z.object({
  ...base,
  headline: localized,
  body: localized,
  image: imagePath,
  alt: localized,
  imageSide: z.enum(["left", "right"]).default("right"),
  ctaLabel: localized,
  ctaHref: z.string().default(""),
});

export const gallerySchema = z.object({
  ...base,
  label: localized,
  headline: localized,
  items: z
    .array(
      z.object({
        image: imagePath,
        alt: localized,
        caption: localized,
      }),
    )
    .max(12),
});

export const ctaSchema = z.object({
  ...base,
  background: background.default("dark"),
  headline: localized,
  subheadline: localized,
  buttonLabel: localized,
  buttonHref: z.string().default("#order-form"),
});

export const faqSchema = z.object({
  ...base,
  label: localized,
  headline: localized,
  items: z
    .array(
      z.object({
        question: localized,
        answer: localized,
      }),
    )
    .max(20),
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const BLOCK_TYPES = [
  "hero",
  "features",
  "steps",
  "order_form",
  "richtext",
  "image",
  "text_image",
  "gallery",
  "cta",
  "faq",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface BlockDef {
  type: BlockType;
  schema: z.ZodType;
  /** Content for a freshly added block — never empty, so the preview shows something. */
  defaults: () => unknown;
  /** lucide icon name for the editor's block list and "add block" menu. */
  icon: string;
  /** Only one instance may exist on the page. */
  singleton?: boolean;
  /**
   * Cannot be deleted (but can be hidden and reordered). Used for the order form,
   * which owns the #order-form anchor that the hero and navbar CTAs point at.
   */
  locked?: boolean;
}

// Declaration order = order of the editor's "add block" menu.
export const BLOCK_DEFS: BlockDef[] = [
  {
    type: "hero",
    schema: heroSchema,
    icon: "Megaphone",
    singleton: true,
    defaults: () => ({
      background: "dark",
      eyebrow: emptyLocalized(),
      headline1: { de: "Deine Idee.", en: "Your idea." },
      headline2: { de: "Wir drucken sie.", en: "We print it." },
      subheadline: emptyLocalized(),
      ctaLabel: { de: "Druckauftrag starten", en: "Start a print order" },
      ctaHref: "#order-form",
    }),
  },
  {
    type: "features",
    schema: featuresSchema,
    icon: "Grid2x2",
    defaults: () => ({
      background: "white",
      label: emptyLocalized(),
      headline: { de: "Darum wir", en: "Why us" },
      items: [
        {
          icon: "Zap",
          tone: "accent",
          title: { de: "Schnell gedruckt", en: "Printed fast" },
          description: emptyLocalized(),
        },
      ],
    }),
  },
  {
    type: "steps",
    schema: stepsSchema,
    icon: "ListOrdered",
    defaults: () => ({
      background: "muted",
      label: emptyLocalized(),
      headline: { de: "So funktioniert's", en: "How it works" },
      items: [
        { number: "01", title: { de: "Einreichen", en: "Submit" }, description: emptyLocalized() },
        { number: "02", title: { de: "Wir drucken", en: "We print" }, description: emptyLocalized() },
        { number: "03", title: { de: "Abholen", en: "Pick up" }, description: emptyLocalized() },
      ],
    }),
  },
  {
    type: "order_form",
    schema: orderFormSchema,
    icon: "FileText",
    singleton: true,
    locked: true,
    defaults: () => ({
      background: "white",
      label: emptyLocalized(),
      headline: { de: "Hast du eine Idee?", en: "Got an idea?" },
      subheadline: emptyLocalized(),
    }),
  },
  {
    type: "richtext",
    schema: richtextSchema,
    icon: "Type",
    defaults: () => ({
      background: "white",
      label: emptyLocalized(),
      headline: { de: "Überschrift", en: "Headline" },
      body: { de: "Dein Text …", en: "" },
    }),
  },
  {
    type: "image",
    schema: imageSchema,
    icon: "Image",
    defaults: () => ({
      background: "white",
      image: "",
      alt: emptyLocalized(),
      caption: emptyLocalized(),
      width: "wide",
    }),
  },
  {
    type: "text_image",
    schema: textImageSchema,
    icon: "Columns2",
    defaults: () => ({
      background: "white",
      headline: { de: "Überschrift", en: "Headline" },
      body: { de: "Dein Text …", en: "" },
      image: "",
      alt: emptyLocalized(),
      imageSide: "right",
      ctaLabel: emptyLocalized(),
      ctaHref: "",
    }),
  },
  {
    type: "gallery",
    schema: gallerySchema,
    icon: "Images",
    defaults: () => ({
      background: "white",
      label: emptyLocalized(),
      headline: { de: "Galerie", en: "Gallery" },
      // One empty slot, not zero: it shows where the pictures go, and it is the
      // template ItemToolbar clones for every further entry.
      items: [{ image: "", alt: emptyLocalized(), caption: emptyLocalized() }],
    }),
  },
  {
    type: "cta",
    schema: ctaSchema,
    icon: "MousePointerClick",
    defaults: () => ({
      background: "dark",
      headline: { de: "Bereit?", en: "Ready?" },
      subheadline: emptyLocalized(),
      buttonLabel: { de: "Jetzt starten", en: "Get started" },
      buttonHref: "#order-form",
    }),
  },
  {
    type: "faq",
    schema: faqSchema,
    icon: "CircleQuestionMark",
    defaults: () => ({
      background: "muted",
      label: emptyLocalized(),
      headline: { de: "Häufige Fragen", en: "Frequently asked questions" },
      items: [{ question: { de: "Frage?", en: "" }, answer: { de: "Antwort.", en: "" } }],
    }),
  },
];

const BY_TYPE = new Map(BLOCK_DEFS.map((d) => [d.type, d]));

export function isBlockType(value: string): value is BlockType {
  return BY_TYPE.has(value as BlockType);
}

export function blockDef(type: BlockType): BlockDef {
  const def = BY_TYPE.get(type);
  if (!def) throw new Error(`Unknown landing block type: ${type}`);
  return def;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface LandingBlock {
  id: string;
  type: BlockType;
  position: number;
  visible: boolean;
  data: unknown;
}

/**
 * Validate a row's data against its type's schema.
 *
 * Returns null instead of throwing: a block whose shape no longer matches (an
 * older row after a schema change, a hand-edited JSON) must not take the whole
 * public page down with it. Callers drop it; the editor flags it.
 */
export function parseBlock(row: {
  id: string;
  type: string;
  position: number;
  visible: boolean;
  data: unknown;
}): LandingBlock | null {
  if (!isBlockType(row.type)) return null;
  const result = blockDef(row.type).schema.safeParse(row.data);
  if (!result.success) return null;
  return {
    id: row.id,
    type: row.type,
    position: row.position,
    visible: row.visible,
    data: result.data,
  };
}
