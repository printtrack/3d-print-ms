import type { Filament } from "@prisma/client";

export interface PartFilamentRequirement {
  material: string | null;
  materialAny: boolean;
  color: string | null;
  colorAny: boolean;
}

/**
 * Pool key for reservation / availability: a part's filament need is now a
 * (material, color) pool rather than one concrete spool. Multiple spools of the
 * same material+color share one pool.
 */
export function poolKey(material: string, color: string): string {
  return `${material.trim().toLowerCase()}|${color.trim().toLowerCase()}`;
}

/**
 * Pool key for a part, or null when the part isn't pinned to a concrete
 * material+color (unset or "egal" on either axis) — such parts can't be
 * attributed to a single stock pool.
 */
export function partPoolKey(part: PartFilamentRequirement): string | null {
  if (!part.material || part.materialAny || !part.color || part.colorAny) return null;
  return poolKey(part.material, part.color);
}

/**
 * Wire sentinel for "egal" / any on a material or color axis. Clients send a
 * single value per axis: a concrete string, the sentinel, or null (unset).
 */
export const FILAMENT_ANY = "ANY";

/** Translate a wire axis value into stored (concrete, any) fields. `undefined` = not provided. */
export function parseAxis(
  value: string | null | undefined
): { concrete: string | null; any: boolean } | undefined {
  if (value === undefined) return undefined;
  if (value === null) return { concrete: null, any: false };
  if (value === FILAMENT_ANY) return { concrete: null, any: true };
  return { concrete: value, any: false };
}

/**
 * Best colorHex for a chosen color, snapshotted onto the part for the 3D preview.
 * Prefers a spool matching material+color; falls back to any spool of that color.
 */
export function deriveColorHex(
  material: string | null,
  color: string | null,
  filaments: Array<{ material: string; color: string; colorHex: string | null }>
): string | null {
  if (!color) return null;
  const c = color.toLowerCase();
  if (material) {
    const m = material.toLowerCase();
    const exact = filaments.find(
      (f) => f.material.toLowerCase() === m && f.color.toLowerCase() === c && f.colorHex
    );
    if (exact?.colorHex) return exact.colorHex;
  }
  return filaments.find((f) => f.color.toLowerCase() === c && f.colorHex)?.colorHex ?? null;
}

/**
 * Can a part be printed on a given machine? A part specifies a material+color
 * requirement; it's printable on a machine if at least one matching spool is
 * compatible with that machine (a spool with no restriction fits everywhere).
 * Parts with no concrete requirement (fully "egal"/unset), or with no matching
 * spool at all, are treated as unconstrained (returns true).
 */
export function partPrintableOnMachine(
  part: PartFilamentRequirement,
  filaments: Array<{ material: string; color: string; compatibleMachineIds: string[] }>,
  machineId: string
): boolean {
  const matching = filaments.filter((f) => {
    const matOk = part.materialAny || (!!part.material && f.material.toLowerCase() === part.material.toLowerCase());
    const colOk = part.colorAny || (!!part.color && f.color.toLowerCase() === part.color.toLowerCase());
    return matOk && colOk;
  });
  if (matching.length === 0) return true;
  return matching.some((f) => f.compatibleMachineIds.length === 0 || f.compatibleMachineIds.includes(machineId));
}

type ResolvableFilament = Pick<Filament, "material" | "color" | "isActive" | "remainingGrams">;

/**
 * Resolve a part's material+color requirement to a concrete inventory spool,
 * used for pricing and inventory deduction. Only resolvable when BOTH axes are
 * concrete (a specific material AND a specific color). Prefers active, in-stock
 * spools with the most remaining material.
 */
export function resolveFilamentForPart<F extends ResolvableFilament>(
  part: PartFilamentRequirement,
  filaments: F[]
): F | null {
  if (!part.material || part.materialAny || !part.color || part.colorAny) return null;
  const material = part.material.toLowerCase();
  const color = part.color.toLowerCase();
  const matches = filaments.filter(
    (f) => f.material.toLowerCase() === material && f.color.toLowerCase() === color
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || b.remainingGrams - a.remainingGrams
  );
  return matches[0];
}
