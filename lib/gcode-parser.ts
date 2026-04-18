/**
 * Extracts estimated print time from G-code file content.
 * Scans the full buffer as text — G-code files are plain ASCII so this is fast
 * even for large files. OrcaSlicer places the time comment deep in the middle
 * of the file, so head/tail chunking is not reliable.
 */
export function extractPrintTimeMinutes(buffer: Buffer): number | null {
  const text = buffer.toString("utf-8");

  // PrusaSlicer / OrcaSlicer / BambuStudio:
  // ; estimated printing time (normal mode) = 1h 23m 45s
  const prusaMatch = text.match(
    /;\s*estimated printing time \(normal mode\)\s*=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i
  );
  if (prusaMatch) {
    const days = parseInt(prusaMatch[1] ?? "0", 10);
    const hours = parseInt(prusaMatch[2] ?? "0", 10);
    const minutes = parseInt(prusaMatch[3] ?? "0", 10);
    const seconds = parseInt(prusaMatch[4] ?? "0", 10);
    const total = days * 1440 + hours * 60 + minutes + Math.round(seconds / 60);
    if (total > 0) return total;
  }

  // Cura: ;TIME:5025  (seconds)
  const curaMatch = text.match(/^;TIME:(\d+)/m);
  if (curaMatch) {
    const seconds = parseInt(curaMatch[1], 10);
    const total = Math.round(seconds / 60);
    if (total > 0) return total;
  }

  return null;
}

export interface GcodeFilamentData {
  /** Grams consumed per material slot (multi-material: one entry per slot). */
  gramsPerSlot: number[];
  /** Material name per slot (e.g. "PLA", "PETG"). Empty string if unknown. */
  materials: string[];
  /** Color hex per slot (e.g. "#FF0000"). null if unknown. */
  colorHexes: (string | null)[];
}

/**
 * Extracts filament usage data from a PrusaSlicer / OrcaSlicer / BambuStudio G-code file.
 * Returns null for Cura files (which only report meters, not grams).
 */
export function extractFilamentData(buffer: Buffer): GcodeFilamentData | null {
  const text = buffer.toString("utf-8");

  // PrusaSlicer / OrcaSlicer / BambuStudio:
  // ; filament used [g] = 12.96
  // ; filament used [g] = 5.23, 7.73  (multi-material, comma-separated)
  const gramsMatch = text.match(/;\s*filament used \[g\]\s*=\s*([\d.,\s]+)/i);
  if (!gramsMatch) return null;

  const gramsPerSlot = gramsMatch[1]
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  if (gramsPerSlot.length === 0) return null;

  // ; filament_type = PLA   or   ; filament_type = PLA;PETG
  const typeMatch = text.match(/;\s*filament_type\s*=\s*([^\n\r]+)/i);
  const materials = typeMatch
    ? typeMatch[1].trim().split(";").map((s) => s.trim()).filter(Boolean)
    : [];

  // ; filament_colour = #FF0000   or   ; filament_colour = #FF0000;#00FF00
  // BambuStudio sometimes uses a space instead of underscore
  const colorMatch = text.match(/;\s*filament[_ ]colour\s*=\s*([^\n\r]+)/i);
  const colorHexes: (string | null)[] = colorMatch
    ? colorMatch[1].trim().split(";").map((s) => {
        const hex = s.trim();
        return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
      })
    : [];

  return { gramsPerSlot, materials, colorHexes };
}
