import { prisma } from "@/lib/db";

const LOW_FILAMENT_THRESHOLD_GRAMS = 100;

/**
 * Deducts actual grams from inventory for all filaments used in a completed job.
 * Returns warning messages for filaments that drop below the threshold.
 */
export async function deductFilamentInventory(jobId: string): Promise<string[]> {
  const usages = await prisma.printJobFilament.findMany({
    where: { printJobId: jobId },
    include: { filament: { select: { id: true, name: true, remainingGrams: true } } },
  });

  const warnings: string[] = [];

  for (const usage of usages) {
    const newRemaining = Math.max(0, usage.filament.remainingGrams - usage.gramsActual);
    await prisma.filament.update({
      where: { id: usage.filamentId },
      data: { remainingGrams: newRemaining },
    });
    if (newRemaining < LOW_FILAMENT_THRESHOLD_GRAMS) {
      warnings.push(`${usage.filament.name} hat nur noch ${newRemaining} g übrig`);
    }
  }

  return warnings;
}

/**
 * Restores inventory grams for a job that is reverted from DONE back to another status.
 */
export async function restoreFilamentInventory(jobId: string): Promise<void> {
  const usages = await prisma.printJobFilament.findMany({
    where: { printJobId: jobId },
    select: { filamentId: true, gramsActual: true },
  });

  for (const usage of usages) {
    await prisma.filament.update({
      where: { id: usage.filamentId },
      data: { remainingGrams: { increment: usage.gramsActual } },
    });
  }
}
