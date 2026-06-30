// Configurable public order form ("Auftragsformular").
//
// Lets a shop tailor its customer intake: which optional fields show / are
// required, which file formats and size/count limits apply, plus an intro text
// and an optional consent checkbox. Defaults reproduce the previous hardcoded
// behaviour, so an untouched install behaves exactly as before.
//
// Stored in the key/value `Setting` store; built into a typed config consumed by
// both the client form and the server routes (/api/orders, /api/uploads).

import { getSettings } from "@/lib/settings";

// The file types the pipeline actually supports (magic-byte validated on upload).
// Admins may narrow the accepted set to a subset of these — never beyond.
export const SUPPORTED_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".stl", ".obj", ".3mf"];
export const DEFAULT_MAX_FILE_MB = 50;

export interface OrderFormConfig {
  deadlineVisible: boolean;
  deadlineRequired: boolean;
  orderTypeVisible: boolean;
  acceptedFormats: string[]; // subset of SUPPORTED_FORMATS
  maxFileMb: number;
  maxFiles: number; // 0 = unlimited
  consentRequired: boolean;
  introText: string; // localized, "" when none
  consentText: string; // localized, "" when none
}

function parseFormats(raw: string | undefined): string[] {
  if (!raw) return [...SUPPORTED_FORMATS];
  const wanted = new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const chosen = SUPPORTED_FORMATS.filter((f) => wanted.has(f));
  // Never end up with an empty allowlist (would block all uploads).
  return chosen.length ? chosen : [...SUPPORTED_FORMATS];
}

function parseIntPositive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function buildOrderFormConfig(
  settings: Record<string, string>,
  locale: "de" | "en",
): OrderFormConfig {
  const suffix = locale === "en" ? "en" : "de";
  return {
    deadlineVisible: settings.orderform_field_deadline_visible !== "false",
    deadlineRequired: settings.orderform_field_deadline_required === "true",
    orderTypeVisible: settings.orderform_field_ordertype_visible !== "false",
    acceptedFormats: parseFormats(settings.orderform_accepted_formats),
    maxFileMb: parseIntPositive(settings.orderform_max_file_mb, DEFAULT_MAX_FILE_MB) || DEFAULT_MAX_FILE_MB,
    maxFiles: parseIntPositive(settings.orderform_max_files, 0),
    consentRequired: settings.orderform_consent_required === "true",
    introText: settings[`orderform_intro_text_${suffix}`]?.trim() || "",
    consentText: settings[`orderform_consent_text_${suffix}`]?.trim() || "",
  };
}

export async function getOrderFormConfig(locale: "de" | "en"): Promise<OrderFormConfig> {
  return buildOrderFormConfig(await getSettings(), locale);
}
