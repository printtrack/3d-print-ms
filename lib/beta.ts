// Beta-Modus: schaltet die In-App-Feedback/Bug-Report-Werkzeuge (schwebender
// Button + Melde-Dialog) frei. Gedacht für die Betaphase; sobald die App stabil
// ist, kann der Admin den Schalter in Einstellungen → Beta abschalten und die
// Werkzeuge verschwinden aus der Oberfläche.
//
// Auflösung folgt demselben Muster wie lib/features.ts: fehlender Setting-Wert
// fällt auf den Default zurück. Default ist AN, damit die Betaphase out-of-the-box
// Feedback einsammeln kann.

import { getSetting } from "@/lib/settings";

export const BETA_MODE_SETTING_KEY = "beta_mode";
const BETA_MODE_DEFAULT = true;

/** Resolve the beta flag from a settings map (sync, for reuse in components). */
export function isBetaEnabledFrom(settings: Record<string, string>): boolean {
  const raw = settings[BETA_MODE_SETTING_KEY];
  return raw === undefined ? BETA_MODE_DEFAULT : raw === "true";
}

/** Whether beta tools (feedback widget) are enabled. Single DB read. */
export async function isBetaEnabled(): Promise<boolean> {
  const raw = await getSetting(BETA_MODE_SETTING_KEY);
  return raw === null ? BETA_MODE_DEFAULT : raw === "true";
}
