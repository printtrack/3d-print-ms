import { prisma } from "./db";
import { ACTIVE_JOB_STATUSES, computeFilamentChanges, type FilamentChange } from "./filament-changes";

/** Filament changes for all active jobs, keyed by job id. */
export async function getFilamentChanges(): Promise<Map<string, FilamentChange>> {
  const [machines, jobs] = await Promise.all([
    prisma.machine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        materialSlots: true,
        filamentSlots: { select: { slot: true, filamentId: true } },
      },
    }),
    prisma.printJob.findMany({
      where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
      select: {
        id: true,
        machineId: true,
        status: true,
        plannedAt: true,
        startedAt: true,
        queuePosition: true,
        filamentChangeConfirmedAt: true,
        plannedFilaments: { select: { filamentId: true } },
      },
    }),
  ]);

  return computeFilamentChanges(machines, jobs);
}

/**
 * Confirms the swap for one job and writes the new spools into the machine's
 * slots — from here on the printer is considered loaded with them.
 */
export async function confirmFilamentChange(jobId: string, userId: string | null): Promise<void> {
  const job = await prisma.printJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      machineId: true,
      machine: { select: { materialSlots: true, filamentSlots: { select: { slot: true, filamentId: true } } } },
      plannedFilaments: { select: { filamentId: true } },
    },
  });
  if (!job) return;

  const slots = Math.max(1, job.machine.materialSlots);
  const needed = [...new Set(job.plannedFilaments.map((f) => f.filamentId))].slice(0, slots);
  const previous = job.machine.filamentSlots
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((s) => s.filamentId)
    .filter((id): id is string => id !== null);

  // Keep spools that stay relevant, fill the remaining slots with the new ones.
  const keep = previous.filter((id) => !needed.includes(id));
  const loaded = [...needed, ...keep].slice(0, slots);

  for (let slot = 1; slot <= slots; slot++) {
    const filamentId = loaded[slot - 1] ?? null;
    await prisma.machineFilamentSlot.upsert({
      where: { machineId_slot: { machineId: job.machineId, slot } },
      create: { machineId: job.machineId, slot, filamentId },
      update: { filamentId },
    });
  }

  await prisma.printJob.update({
    where: { id: jobId },
    data: { filamentChangeConfirmedAt: new Date(), filamentChangeConfirmedBy: userId },
  });
}
