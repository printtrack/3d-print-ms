import { prisma } from "@/lib/db";
import { poolKey } from "@/lib/filament-resolve";

// Aktive Job-Status: alle, deren Filament noch nicht verbraucht ist.
// Bei DONE wurde es beim Verify schon vom remainingGrams abgezogen;
// CANCELLED wird nicht gedruckt.
const ACTIVE_JOB_STATUSES = ["PLANNED", "SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION"] as const;

/**
 * Reservierung pro (material|color)-**Pool**. Ein Teil pinnt keine konkrete Spule
 * mehr, sondern eine Material+Farbe-Anforderung — mehrere Spulen desselben Pools
 * teilen sich den Bestand.
 *
 * Vorrang-Logik pro Job:
 * - Wenn `filamentUsages` existieren (G-Code hochgeladen): deren `gramsActual`
 *   dem Pool der jeweiligen Spule (`material|color`) zuordnen.
 * - Sonst: `OrderPart.gramsEstimated * quantity` je Pool der Job-Parts summieren.
 *   Teile ohne konkretes Material+Farbe (unset/"egal") sind keinem Pool
 *   zuzuordnen und werden übersprungen.
 */
export async function getReservedGramsByPool(): Promise<Map<string, number>> {
  const activeJobs = await prisma.printJob.findMany({
    where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
    select: {
      id: true,
      filamentUsages: { select: { gramsActual: true, filament: { select: { material: true, color: true } } } },
      parts: {
        select: {
          orderPart: {
            select: { material: true, materialAny: true, color: true, colorAny: true, gramsEstimated: true, quantity: true },
          },
        },
      },
    },
  });

  const reserved = new Map<string, number>();
  const add = (key: string, grams: number) => {
    reserved.set(key, (reserved.get(key) ?? 0) + grams);
  };

  for (const job of activeJobs) {
    if (job.filamentUsages.length > 0) {
      for (const u of job.filamentUsages) add(poolKey(u.filament.material, u.filament.color), u.gramsActual);
      continue;
    }
    for (const p of job.parts) {
      const op = p.orderPart;
      if (!op.material || op.materialAny || !op.color || op.colorAny || op.gramsEstimated == null) continue;
      add(poolKey(op.material, op.color), op.gramsEstimated * op.quantity);
    }
  }

  return reserved;
}

export interface PoolAvailability {
  remaining: number;
  reserved: number;
  available: number;
}

/**
 * Pro (material|color)-Pool: Gesamtbestand (Summe aller Spulen dieses Pools),
 * Reservierung und Verfügbarkeit (kann negativ sein).
 */
export async function getPoolAvailability(): Promise<Map<string, PoolAvailability>> {
  const [filaments, reserved] = await Promise.all([
    prisma.filament.findMany({ select: { material: true, color: true, remainingGrams: true } }),
    getReservedGramsByPool(),
  ]);

  const remainingByPool = new Map<string, number>();
  for (const f of filaments) {
    const key = poolKey(f.material, f.color);
    remainingByPool.set(key, (remainingByPool.get(key) ?? 0) + f.remainingGrams);
  }

  const out = new Map<string, PoolAvailability>();
  const keys = new Set([...remainingByPool.keys(), ...reserved.keys()]);
  for (const key of keys) {
    const remaining = remainingByPool.get(key) ?? 0;
    const r = reserved.get(key) ?? 0;
    out.set(key, { remaining, reserved: r, available: remaining - r });
  }
  return out;
}

/**
 * Wie viele Teile verlangen jeden (material|color)-Pool — für die
 * Bestands-/Nutzungsanzeige im Inventar (ersetzt den früheren
 * `_count.orderParts` pro Spule).
 */
export async function getPartCountByPool(): Promise<Map<string, number>> {
  const grouped = await prisma.orderPart.groupBy({
    by: ["material", "color"],
    where: { material: { not: null }, color: { not: null } },
    _count: { _all: true },
  });
  const out = new Map<string, number>();
  for (const g of grouped) {
    if (!g.material || !g.color) continue;
    out.set(poolKey(g.material, g.color), (out.get(poolKey(g.material, g.color)) ?? 0) + g._count._all);
  }
  return out;
}
