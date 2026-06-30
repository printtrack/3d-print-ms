// White-label branding resolved from the key/value `Setting` store.
//
// The brand accent is applied app-wide through the `--brand-accent` CSS variable
// (declared in app/globals.css). The root layout injects an override for it from
// the `brand_accent_color` setting, so admin, landing, portal and tracking all
// follow one configurable accent. Logo / favicon / app title are likewise
// configurable.

import { getSettings } from "@/lib/settings";

export const DEFAULT_ACCENT = "oklch(0.72 0.18 55)";

/**
 * Conservatively validate a CSS color coming from settings, so a stored value
 * can never break out of the declaration and inject arbitrary CSS. Accepts hex,
 * rgb(a)/hsl(a)/oklch/oklab/lab/lch/color(). Returns null for anything else.
 */
export function sanitizeColor(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length > 64) return null;
  if (/[;{}<>\\]/.test(v)) return null; // no statement terminators / tag breakers
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-zA-Z.,%/\s-]+\)$/.test(v)) return v;
  return null;
}

export interface Branding {
  /** Sanitized accent color, or the default amber when unset/invalid. */
  accentColor: string;
  /** True when a valid custom accent (≠ default) is configured. */
  customAccent: boolean;
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string;
}

export async function getBranding(): Promise<Branding> {
  const s = await getSettings();
  const sanitized = sanitizeColor(s.brand_accent_color);
  const accentColor = sanitized ?? DEFAULT_ACCENT;
  return {
    accentColor,
    customAccent: sanitized !== null && sanitized !== DEFAULT_ACCENT,
    // The company logo (uploaded under Settings → Belege) doubles as the
    // app/sidebar logo, so white-labeling needs only one upload.
    logoUrl: s.billing_logo_url?.trim() || null,
    faviconUrl: s.brand_favicon_url?.trim() || null,
    companyName: s.company_name?.trim() || "3D Print CMS",
  };
}

/**
 * Inline CSS that overrides the brand accent (and a derived darker shade) at the
 * document root. Returns an empty string for the default accent so the hand-tuned
 * defaults in globals.css stay pixel-identical when nothing is customized.
 */
export function brandAccentCss(branding: Branding): string {
  if (!branding.customAccent) return "";
  const a = branding.accentColor;
  return `:root{--brand-accent:${a};--brand-accent-dim:color-mix(in oklab, ${a} 82%, black);}`;
}
