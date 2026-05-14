/**
 * Maps DB-stored German phase names to their next-intl translation keys.
 * The message catalog namespace is "phases".
 * Falls back to the original name if no key exists.
 */
export function getPhaseLabelKey(phaseName: string): string | null {
  const knownKeys = [
    "Eingegangen",
    "In Prüfung",
    "In Bearbeitung",
    "Abholbereit",
    "Abgeschlossen",
    "Design",
    "Überprüfung",
    "Druckbereit",
    "Gedruckt",
    "Fehldruck",
    "Planung",
    "Aktiv",
    "Pausiert",
    "Archiviert",
  ];
  return knownKeys.includes(phaseName) ? phaseName : null;
}
