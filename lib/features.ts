// Single source of truth for optional product modules ("Funktionsumfang").
//
// The CMS ships with every module enabled, but an admin can switch individual
// modules off in Settings → Module to tailor the product to a given shop
// (e.g. "quotes only, no invoices", or a shop with no knowledge base / portal).
//
// Each module maps to a key/value `Setting` row. Resolution follows the same
// pattern as lib/tracking-timeline.ts (`isEventVisible`): a missing setting
// falls back to the module's `defaultEnabled`. Defaults keep the app fully
// backwards-compatible (everything on, except modules that were already opt-in).
//
// This module is pure data + helpers (the sync parts have no React/Next imports)
// so the registry can be used in both server components and client UI. Only
// `getEnabledFeatures` / `assertFeature` touch the DB / NextResponse.

import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export type FeatureKey =
  | "quotes"
  | "invoices"
  | "jobs"
  | "projects"
  | "planning"
  | "inventory"
  | "knowledge"
  | "portal"
  | "tracking"
  | "survey"
  | "timeline";

export interface FeatureDef {
  key: FeatureKey;
  /** Setting row key. Reuses existing keys where a toggle already existed. */
  settingKey: string;
  /** Fallback when no setting row exists. */
  defaultEnabled: boolean;
  /** When set, this feature is only enabled if its dependency is too. */
  dependsOn?: FeatureKey;
}

// Declaration order = order shown in the Settings "Module" section.
export const FEATURES: FeatureDef[] = [
  { key: "quotes", settingKey: "module_quotes_enabled", defaultEnabled: true },
  { key: "invoices", settingKey: "module_invoices_enabled", defaultEnabled: true, dependsOn: "quotes" },
  { key: "jobs", settingKey: "module_jobs_enabled", defaultEnabled: true },
  { key: "projects", settingKey: "module_projects_enabled", defaultEnabled: true },
  { key: "planning", settingKey: "module_planning_enabled", defaultEnabled: true },
  { key: "inventory", settingKey: "module_inventory_enabled", defaultEnabled: true },
  { key: "knowledge", settingKey: "module_knowledge_enabled", defaultEnabled: true },
  { key: "portal", settingKey: "module_portal_enabled", defaultEnabled: true },
  { key: "tracking", settingKey: "module_tracking_enabled", defaultEnabled: true },
  // Reuse pre-existing toggles so we don't duplicate state.
  { key: "survey", settingKey: "survey_enabled", defaultEnabled: false },
  { key: "timeline", settingKey: "tracking_timeline_enabled", defaultEnabled: true },
];

const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

/**
 * Resolve whether a single feature is enabled given a settings map.
 * Honours the module's own toggle AND any dependency chain
 * (e.g. invoices is off whenever quotes is off).
 */
export function isFeatureEnabled(key: FeatureKey, settings: Record<string, string>): boolean {
  const def = FEATURE_BY_KEY.get(key);
  if (!def) return false;
  const raw = settings[def.settingKey];
  const self = raw === undefined ? def.defaultEnabled : raw === "true";
  if (!self) return false;
  if (def.dependsOn) return isFeatureEnabled(def.dependsOn, settings);
  return true;
}

/** Typed map of every module's resolved enabled state (one DB read). */
export async function getEnabledFeatures(): Promise<Record<FeatureKey, boolean>> {
  const settings = await getSettings();
  return Object.fromEntries(
    FEATURES.map((f) => [f.key, isFeatureEnabled(f.key, settings)]),
  ) as Record<FeatureKey, boolean>;
}

/**
 * API-route guard. Returns a 403 NextResponse when the feature is disabled,
 * or `null` when enabled. Usage:
 *   const guard = await assertFeature("quotes");
 *   if (guard) return guard;
 */
export async function assertFeature(key: FeatureKey): Promise<NextResponse | null> {
  const features = await getEnabledFeatures();
  if (features[key]) return null;
  return NextResponse.json(
    { error: "Diese Funktion ist deaktiviert." },
    { status: 403 },
  );
}
