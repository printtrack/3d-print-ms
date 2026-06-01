import { prisma } from "@/lib/db";

// Aktive Job-Status: alle, deren Filament noch nicht verbraucht ist.
// Bei DONE wurde es beim Verify schon vom remainingGrams abgezogen;
// CANCELLED wird nicht gedruckt.
const ACTIVE_JOB_STATUSES = ["PLANNED", "SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION"] as const;

/**
 * Summiert die eingeplante Filament-Menge aller aktiven Druckjobs pro filamentId.
 *
 * Vorrang-Logik pro Job:
 * - Wenn `filamentUsages` Records existieren (= G-Code wurde hochgeladen und
 *   extrahiert), nutze deren Werte. `PrintJobFilament.gramsActual` ist hier
 *   irreführend benannt: nach G-Code-Upload steht da die geplante Menge aus
 *   dem G-Code, NICHT der tatsächliche Verbrauch (der wird beim Verify aus
 *   `OrderPartIteration.gramsActual` direkt am `Filament.remainingGrams`
 *   abgezogen, ohne PrintJobFilament zu mutieren).
 * - Sonst: summiere `OrderPart.gramsEstimated * quantity` pro filamentId der
 *   Job-Parts. Parts ohne filamentId oder ohne Estimate werden ignoriert.
 */
export async function getReservedGramsByFilament(): Promise<Map<string, number>> {
  const activeJobs = await prisma.printJob.findMany({
    where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
    select: {
      id: true,
      filamentUsages: { select: { filamentId: true, gramsActual: true } },
      parts: {
        select: {
          orderPart: {
            select: { filamentId: true, gramsEstimated: true, quantity: true },
          },
        },
      },
    },
  });

  const reserved = new Map<string, number>();
  const add = (filamentId: string, grams: number) => {
    reserved.set(filamentId, (reserved.get(filamentId) ?? 0) + grams);
  };

  for (const job of activeJobs) {
    if (job.filamentUsages.length > 0) {
      for (const u of job.filamentUsages) add(u.filamentId, u.gramsActual);
      continue;
    }
    for (const p of job.parts) {
      const op = p.orderPart;
      if (!op.filamentId || op.gramsEstimated == null) continue;
      add(op.filamentId, op.gramsEstimated * op.quantity);
    }
  }

  return reserved;
}

export interface FilamentAvailability {
  remaining: number;
  reserved: number;
  available: number;
}

/**
 * Liefert pro Filament Bestand, Reservierung und Verfügbarkeit (kann negativ sein).
 */
export async function getFilamentAvailability(): Promise<Map<string, FilamentAvailability>> {
  const [filaments, reserved] = await Promise.all([
    prisma.filament.findMany({ select: { id: true, remainingGrams: true } }),
    getReservedGramsByFilament(),
  ]);

  const out = new Map<string, FilamentAvailability>();
  for (const f of filaments) {
    const r = reserved.get(f.id) ?? 0;
    out.set(f.id, { remaining: f.remainingGrams, reserved: r, available: f.remainingGrams - r });
  }
  return out;
}
