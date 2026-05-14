/**
 * Maps DB-stored German filament color names to their next-intl translation keys.
 * Namespace: "filaments". Falls back to original name if no key exists.
 */
export function getFilamentColorKey(colorName: string): string | null {
  const knownColors = ["Weiß", "Schwarz", "Transparent Blau"];
  return knownColors.includes(colorName) ? colorName : null;
}
