import fs from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { computeBbox, pickPrintOrientation, applyQuaternionToBbox } from "./stl-bbox";
import { isIdentityQuaternion } from "./stl-transform";
import { getUploadDir } from "./uploads";
import { getReservedGramsByPool } from "./filament-reservations";
import { poolKey } from "./filament-resolve";
import { currentlyDownMachineIds } from "./machine-downtime";

export interface InsufficientFilament {
  available: number;
  needed: number;
}

export interface ProposedNewJob {
  type: "new";
  machineId: string;
  machineName: string;
  /** Primary spool — kept for display; `filamentIds` is the full set. */
  filamentId: string;
  filamentLabel: string;
  /** All spools this job needs; more than one only on multi-material printers. */
  filamentIds: string[];
  parts: {
    orderPartId: string;
    partName: string;
    orderId: string;
    quantity: number;
  }[];
  utilizationPct: number;
  estimatedGramsTotal: number | null;
  insufficientFilament: InsufficientFilament | null;
}

export interface ProposedExtendJob {
  type: "extend";
  existingJobId: string;
  machineId: string;
  machineName: string;
  filamentId: string;
  filamentLabel: string;
  filamentIds: string[];
  parts: {
    orderPartId: string;
    partName: string;
    orderId: string;
    quantity: number;
  }[];
  addedGramsTotal: number | null;
  insufficientFilament: InsufficientFilament | null;
}

export type ProposedJob = ProposedNewJob | ProposedExtendJob;

export interface SkippedPart {
  orderPartId: string;
  partName: string;
  orderId: string;
  reason: string;
}

type PartWithRelations = Awaited<ReturnType<typeof getPrintReadyParts>>[number];

async function getPrintReadyParts() {
  return prisma.orderPart.findMany({
    where: {
      partPhase: { OR: [{ isPrintReady: true }, { isMisprint: true }] },
      printJobParts: {
        none: { printJob: { status: { notIn: ["DONE", "CANCELLED"] } } },
      },
    },
    include: {
      order: { select: { id: true } },
    },
  });
}

/** Inventory spool enriched with its compatible machine ids (empty = all machines). */
interface PlannerFilament {
  id: string;
  material: string;
  color: string;
  colorHex: string | null;
  name: string;
  remainingGrams: number;
  isActive: boolean;
  compatibleMachineIds: string[];
}

function matchesAxes(f: PlannerFilament, part: PartWithRelations): boolean {
  const matOk = part.materialAny || (!!part.material && f.material.toLowerCase() === part.material.toLowerCase());
  const colOk = part.colorAny || (!!part.color && f.color.toLowerCase() === part.color.toLowerCase());
  return matOk && colOk;
}

function isCompatible(f: PlannerFilament, machineId: string): boolean {
  return f.compatibleMachineIds.length === 0 || f.compatibleMachineIds.includes(machineId);
}

function filamentLabelOf(f: PlannerFilament): string {
  return `${f.material} ${f.color}${f.name ? ` (${f.name})` : ""}`;
}

async function findStlFile(part: PartWithRelations) {
  const allFiles = await prisma.orderFile.findMany({
    where: {
      orderId: part.orderId,
      OR: [
        { orderPartId: part.id },
        { orderPartId: null },
        // Color variants share one design owned by any group member.
        ...(part.variantGroupId ? [{ orderPart: { variantGroupId: part.variantGroupId } }] : []),
      ],
    },
  });

  return allFiles.find(
    (f) =>
      f.filename.toLowerCase().endsWith(".stl") ||
      f.mimeType === "application/vnd.ms-pki.stl" ||
      f.mimeType === "application/octet-stream"
  ) ?? null;
}

async function ensureBboxCached(part: PartWithRelations): Promise<{ x: number; y: number; z: number } | null> {
  if (part.bboxXmm !== null && part.bboxYmm !== null && part.bboxZmm !== null) {
    return { x: part.bboxXmm, y: part.bboxYmm, z: part.bboxZmm };
  }

  const stlFile = await findStlFile(part);
  if (!stlFile) return null;

  const filePath = path.join(getUploadDir(), part.orderId, stlFile.filename);
  try {
    const buffer = await fs.readFile(filePath);
    const bbox = computeBbox(buffer);
    await prisma.orderPart.update({
      where: { id: part.id },
      data: { bboxXmm: bbox.x, bboxYmm: bbox.y, bboxZmm: bbox.z },
    });
    return bbox;
  } catch {
    return null;
  }
}

type PackItem = { part: PartWithRelations; bbox: { x: number; y: number; z: number } };
type Build = { x: number; y: number; z: number };
type Orientation = { width: number; depth: number; height: number };

/**
 * Print orientation of a part inside a given build volume, or null when it
 * doesn't fit at all. Respects a user-picked face (non-identity quaternion);
 * otherwise the best automatic orientation is used.
 */
export function orientationFor(
  part: { orientQx: number; orientQy: number; orientQz: number; orientQw: number },
  bbox: Build,
  build: Build
): Orientation | null {
  const q = { qx: part.orientQx, qy: part.orientQy, qz: part.orientQz, qw: part.orientQw };

  if (!isIdentityQuaternion(q)) {
    // User picked a face — use the rotated bbox (Z is the print height in Z-up convention)
    const rotated = applyQuaternionToBbox(bbox, q);
    const w = Math.min(rotated.x, rotated.y);
    const d = Math.max(rotated.x, rotated.y);
    const h = rotated.z;
    if (h > build.z || (w > build.x && w > build.y) || (d > build.x && d > build.y)) return null;
    return { width: w, depth: d, height: h };
  }

  return pickPrintOrientation(bbox, build);
}

export function buildOf(machine: { buildVolumeX: number; buildVolumeY: number; buildVolumeZ: number }): Build {
  return { x: machine.buildVolumeX, y: machine.buildVolumeY, z: machine.buildVolumeZ };
}

interface PackResult {
  batches: Array<{ batch: PackItem[]; usedArea: number; gramsTotal: number | null }>;
  /** Parts that don't fit on THIS machine — the caller retries them elsewhere. */
  oversized: PackItem[];
}

/**
 * Packs a group of parts onto one machine. Parts that don't fit this machine's
 * build volume are returned as `oversized` (not skipped) so the caller can try
 * the next compatible printer — a part being too large for the round-robin
 * machine must never cost it its slot on a bigger one.
 */
function packGroup(
  parts: PackItem[],
  machine: { id: string; name: string; buildVolumeX: number; buildVolumeY: number; buildVolumeZ: number },
  existingUsedArea = 0
): PackResult {
  const build = buildOf(machine);
  const bedArea = build.x * build.y;

  const oversized: PackItem[] = [];
  const eligible: Array<{
    part: PartWithRelations;
    bbox: { x: number; y: number; z: number };
    orientation: Orientation;
    footprint: number;
  }> = [];

  for (const { part, bbox } of parts) {
    const orientation = orientationFor(part, bbox, build);
    if (!orientation) {
      oversized.push({ part, bbox });
      continue;
    }
    eligible.push({ part, bbox, orientation, footprint: orientation.width * orientation.depth });
  }

  eligible.sort((a, b) => b.footprint - a.footprint);

  const batches: PackResult["batches"] = [];
  let remaining = [...eligible];
  let firstBatch = true;

  while (remaining.length > 0) {
    let usedArea = firstBatch ? existingUsedArea : 0;
    let maxHeight = 0;
    const batch: typeof eligible = [];
    const leftover: typeof eligible = [];

    for (const item of remaining) {
      const added = usedArea + item.footprint * item.part.quantity;
      if (added > bedArea * 0.7 || Math.max(maxHeight, item.orientation.height) > build.z) {
        leftover.push(item);
      } else {
        usedArea += item.footprint * item.part.quantity;
        maxHeight = Math.max(maxHeight, item.orientation.height);
        batch.push(item);
      }
    }

    if (batch.length === 0) {
      // Nothing fit into the partially filled bed of an existing job — retry on
      // a fresh plate before giving up on this machine.
      if (firstBatch && existingUsedArea > 0) {
        firstBatch = false;
        continue;
      }
      oversized.push(...remaining.map(({ part, bbox }) => ({ part, bbox })));
      break;
    }

    let gramsTotal: number | null = 0;
    for (const { part } of batch) {
      if (part.gramsEstimated === null) { gramsTotal = null; break; }
      gramsTotal += part.gramsEstimated * part.quantity;
    }

    batches.push({
      batch: batch.map(({ part, bbox }) => ({ part, bbox })),
      usedArea: usedArea - (firstBatch ? existingUsedArea : 0),
      gramsTotal,
    });
    remaining = leftover;
    firstBatch = false;
  }

  return { batches, oversized };
}

export async function plan(): Promise<{ proposed: ProposedJob[]; skipped: SkippedPart[] }> {
  const [parts, activeMachines, rawFilaments, reservedByPool, downMachineIds] = await Promise.all([
    getPrintReadyParts(),
    prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { filamentSlots: { select: { filamentId: true } } },
    }),
    prisma.filament.findMany({ include: { compatibleMachines: { select: { id: true } } } }),
    getReservedGramsByPool(),
    currentlyDownMachineIds(),
  ]);

  // A machine that is currently down (maintenance / defect) can't take new jobs.
  const machines = activeMachines.filter((m) => !downMachineIds.has(m.id));

  if (machines.length === 0) return { proposed: [], skipped: [] };

  const allFilaments: PlannerFilament[] = rawFilaments.map((f) => ({
    id: f.id,
    material: f.material,
    color: f.color,
    colorHex: f.colorHex,
    name: f.name,
    remainingGrams: f.remainingGrams,
    isActive: f.isActive,
    compatibleMachineIds: f.compatibleMachines.map((m) => m.id),
  }));
  const activeFilaments = allFilaments.filter((f) => f.isActive);

  // Total physical stock per (material|color) pool — reservation & availability
  // are pool-wide now, not per single spool.
  const poolRemaining = new Map<string, number>();
  for (const f of allFilaments) {
    const key = poolKey(f.material, f.color);
    poolRemaining.set(key, (poolRemaining.get(key) ?? 0) + f.remainingGrams);
  }

  const machinesCompatibleWith = (f: PlannerFilament) => machines.filter((m) => isCompatible(f, m.id));

  // Track per-pool grams already allocated to earlier proposals in THIS run.
  const proposedSoFar = new Map<string, number>();
  const checkSufficiency = (f: PlannerFilament, needed: number | null): InsufficientFilament | null => {
    if (needed === null) return null;
    const key = poolKey(f.material, f.color);
    const remaining = poolRemaining.get(key) ?? 0;
    const reserved = reservedByPool.get(key) ?? 0;
    const alreadyProposed = proposedSoFar.get(key) ?? 0;
    const available = remaining - reserved - alreadyProposed;
    return needed > available ? { available, needed } : null;
  };
  const recordProposed = (f: PlannerFilament, needed: number | null) => {
    if (needed === null) return;
    const key = poolKey(f.material, f.color);
    proposedSoFar.set(key, (proposedSoFar.get(key) ?? 0) + needed);
  };

  // Resolve a part's material+color requirement to a concrete spool that has at
  // least one compatible active machine. Returns the highest-stock candidate,
  // optionally preferring a spool already chosen as an anchor (for co-batching).
  //
  // When the part's bbox is known, spools whose compatible printers are all too
  // small are filtered out first: with "Farbe/Material egal" the spool choice
  // decides which printers are reachable, so picking a small-printer-only spool
  // would strand a large part that another spool could have printed.
  const resolvePart = (
    part: PartWithRelations,
    preferIds?: Set<string>,
    bbox?: { x: number; y: number; z: number }
  ): PlannerFilament | { skip: string } => {
    const matSet = part.materialAny || !!part.material;
    const colSet = part.colorAny || !!part.color;
    if (!matSet) return { skip: "Material nicht festgelegt" };
    if (!colSet) return { skip: "Farbe nicht festgelegt" };
    const axisMatches = activeFilaments.filter((f) => matchesAxes(f, part));
    if (axisMatches.length === 0) return { skip: "Kein passendes Filament auf Lager" };
    const compatMatches = axisMatches.filter((f) => machinesCompatibleWith(f).length > 0);
    if (compatMatches.length === 0) return { skip: "Kein kompatibler Drucker verfügbar" };

    let candidates = compatMatches;
    if (bbox) {
      const fitting = compatMatches.filter((f) =>
        machinesCompatibleWith(f).some((m) => orientationFor(part, bbox, buildOf(m)) !== null)
      );
      // No spool reaches a printer large enough — packGroup would report the same,
      // but reporting it here keeps the reason precise.
      if (fitting.length === 0) {
        return { skip: `Zu groß für alle passenden Drucker (${bbox.x}×${bbox.y}×${bbox.z} mm)` };
      }
      candidates = fitting;
    }

    if (preferIds) {
      const anchor = candidates.find((f) => preferIds.has(f.id));
      if (anchor) return anchor;
    }
    return [...candidates].sort((a, b) => b.remainingGrams - a.remainingGrams)[0];
  };

  // Load existing PLANNED jobs that haven't started yet — their plate is still
  // open, so we prefer filling them up (they may already carry a plannedAt from
  // the auto-scheduler).
  const existingPlannedJobs = await prisma.printJob.findMany({
    where: { status: "PLANNED", startedAt: null },
    include: {
      machine: true,
      parts: {
        include: {
          orderPart: {
            select: {
              id: true,
              name: true,
              bboxXmm: true,
              bboxYmm: true,
              bboxZmm: true,
              gramsEstimated: true,
              quantity: true,
              material: true,
              materialAny: true,
              color: true,
              colorAny: true,
              colorHex: true,
              orientQx: true,
              orientQy: true,
              orientQz: true,
              orientQw: true,
              order: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  // Compute used bed area per existing job (keyed by jobId)
  const existingJobUsedArea = new Map<string, number>();
  for (const job of existingPlannedJobs) {
    const machine = machines.find((m) => m.id === job.machineId);
    if (!machine) continue;
    const bedArea = machine.buildVolumeX * machine.buildVolumeY;
    let used = 0;
    for (const pjp of job.parts) {
      const p = pjp.orderPart;
      if (p.bboxXmm && p.bboxYmm) used += p.bboxXmm * p.bboxYmm * p.quantity;
    }
    existingJobUsedArea.set(job.id, Math.min(used, bedArea * 0.7));
  }

  const skipped: SkippedPart[] = [];
  const proposed: ProposedJob[] = [];

  // --- Bounding boxes first: the spool choice below is size-aware ------------
  const bboxByPart = new Map<string, { x: number; y: number; z: number }>();
  await Promise.all(
    parts.map(async (part) => {
      const bbox = await ensureBboxCached(part);
      if (bbox) bboxByPart.set(part.id, bbox);
    })
  );
  const plannableParts: PartWithRelations[] = [];
  for (const part of parts) {
    if (bboxByPart.has(part.id)) plannableParts.push(part);
    else skipped.push({ orderPartId: part.id, partName: part.name, orderId: part.orderId, reason: "Keine STL-Datei gefunden" });
  }

  // --- Two-pass resolution: pin each plannable part to a concrete spool -------
  const resolvedByPart = new Map<string, PlannerFilament>();
  const anchors = new Set<string>();

  // Pass 1: fully concrete parts (specific material AND color) seed the anchors.
  for (const part of plannableParts) {
    if (part.material && !part.materialAny && part.color && !part.colorAny) {
      const r = resolvePart(part, undefined, bboxByPart.get(part.id));
      if (!("skip" in r)) {
        resolvedByPart.set(part.id, r);
        anchors.add(r.id);
      }
    }
  }
  // Pass 2: everything else, preferring an anchor spool to fill an existing bed.
  for (const part of plannableParts) {
    if (resolvedByPart.has(part.id)) continue;
    const r = resolvePart(part, anchors, bboxByPart.get(part.id));
    if ("skip" in r) {
      skipped.push({ orderPartId: part.id, partName: part.name, orderId: part.orderId, reason: r.skip });
    } else {
      resolvedByPart.set(part.id, r);
    }
  }

  // --- Group resolved parts by concrete spool --------------------------------
  const groups = new Map<string, { filament: PlannerFilament; items: PackItem[] }>();
  for (const part of plannableParts) {
    const filament = resolvedByPart.get(part.id);
    if (!filament) continue; // already skipped
    const g = groups.get(filament.id) ?? { filament, items: [] };
    g.items.push({ part, bbox: bboxByPart.get(part.id)! });
    groups.set(filament.id, g);
  }

  // Map resolved filamentId → first existing PLANNED job that already uses it,
  // so we prefer extending that job (and its machine) over a fresh one.
  const existingJobByFilamentId = new Map<string, typeof existingPlannedJobs[number]>();
  for (const job of existingPlannedJobs) {
    if (!machines.some((m) => m.id === job.machineId)) continue;
    for (const pjp of job.parts) {
      const r = resolvePart(pjp.orderPart as unknown as PartWithRelations);
      if ("skip" in r) continue;
      if (!existingJobByFilamentId.has(r.id)) existingJobByFilamentId.set(r.id, job);
    }
  }

  /** machineId → spools that already have a proposal there (multi-material packing). */
  const spoolsProposedPerMachine = new Map<string, Set<string>>();
  /** machineId → bed area already claimed by proposals, in percent. */
  const utilizationPerMachine = new Map<string, number>();

  for (const [filamentId, group] of groups.entries()) {
    const filament = group.filament;
    const compatList = machinesCompatibleWith(filament);
    if (compatList.length === 0) {
      for (const { part } of group.items) {
        skipped.push({ orderPartId: part.id, partName: part.name, orderId: part.orderId, reason: "Kein kompatibler Drucker verfügbar" });
      }
      continue;
    }

    // Prefer the machine of an existing job using this spool, if it's compatible.
    const existingJobForFilament = existingJobByFilamentId.get(filamentId);

    // Printers that already hold this spool need no filament change — that beats
    // round-robin. Among those, a multi-material machine with a free slot and a
    // mostly empty plate wins, so two colours can share one job; otherwise jobs
    // stay spread across the printers instead of piling up on the AMS.
    const alreadyLoaded = compatList.filter((m) =>
      m.filamentSlots.some((fs) => fs.filamentId === filament.id)
    );
    const hasRoomForAnotherColour = (m: (typeof compatList)[number]) => {
      const slots = Math.max(1, m.materialSlots);
      if (slots < 2) return false;
      const spools = spoolsProposedPerMachine.get(m.id) ?? new Set<string>();
      if (spools.has(filament.id)) return true;
      return spools.size < slots && (utilizationPerMachine.get(m.id) ?? 0) < 40;
    };
    const preferred =
      alreadyLoaded.find(hasRoomForAnotherColour) ??
      alreadyLoaded.find((m) => !spoolsProposedPerMachine.has(m.id)) ??
      alreadyLoaded[0];

    // No printer holds this spool: spread the work — take the compatible machine
    // with the least already-proposed load.
    const leastLoaded = [...compatList].sort(
      (a, b) => (utilizationPerMachine.get(a.id) ?? 0) - (utilizationPerMachine.get(b.id) ?? 0)
    )[0];

    const primaryMachine =
      existingJobForFilament && compatList.some((m) => m.id === existingJobForFilament.machineId)
        ? compatList.find((m) => m.id === existingJobForFilament.machineId)!
        : preferred ?? leastLoaded;

    // Fallback order: preferred machine first, then the remaining compatible ones
    // by descending build volume — a part too large for the preferred printer
    // still gets planned on a bigger one instead of being skipped.
    const machineOrder = [
      primaryMachine,
      ...compatList
        .filter((m) => m.id !== primaryMachine.id)
        .sort(
          (a, b) =>
            b.buildVolumeX * b.buildVolumeY * b.buildVolumeZ -
            a.buildVolumeX * a.buildVolumeY * a.buildVolumeZ
        ),
    ];

    const filamentLabel = filamentLabelOf(filament);
    let pending = group.items;

    for (const machine of machineOrder) {
      if (pending.length === 0) break;
      const bedArea = machine.buildVolumeX * machine.buildVolumeY;

      // Existing job on this machine that already uses this spool → extend it.
      const matchingExistingJob = existingPlannedJobs.find(
        (j) =>
          j.machineId === machine.id &&
          j.parts.some((pjp) => {
            const r = resolvePart(pjp.orderPart as unknown as PartWithRelations);
            return !("skip" in r) && r.id === filamentId;
          })
      );

      const usedArea = matchingExistingJob ? existingJobUsedArea.get(matchingExistingJob.id) ?? 0 : 0;
      const { batches, oversized } = packGroup(pending, machine, usedArea);
      pending = oversized;

      batches.forEach((batch, i) => {
        const isExtend = matchingExistingJob && i === 0;
        const partsPayload = batch.batch.map(({ part }) => ({
          orderPartId: part.id,
          partName: part.name,
          orderId: part.order.id,
          quantity: part.quantity,
        }));
        if (isExtend) {
          proposed.push({
            type: "extend",
            existingJobId: matchingExistingJob!.id,
            machineId: machine.id,
            machineName: machine.name,
            filamentId: filament.id,
            filamentLabel,
            filamentIds: [filament.id],
            parts: partsPayload,
            addedGramsTotal: batch.gramsTotal,
            insufficientFilament: checkSufficiency(filament, batch.gramsTotal),
          });
        } else {
          proposed.push({
            type: "new",
            machineId: machine.id,
            machineName: machine.name,
            filamentId: filament.id,
            filamentLabel,
            filamentIds: [filament.id],
            parts: partsPayload,
            utilizationPct: Math.round((batch.usedArea / bedArea) * 100),
            estimatedGramsTotal: batch.gramsTotal,
            insufficientFilament: checkSufficiency(filament, batch.gramsTotal),
          });
        }
        recordProposed(filament, batch.gramsTotal);
        const spools = spoolsProposedPerMachine.get(machine.id) ?? new Set<string>();
        spools.add(filament.id);
        spoolsProposedPerMachine.set(machine.id, spools);
        const pct = Math.round((batch.usedArea / bedArea) * 100);
        utilizationPerMachine.set(machine.id, (utilizationPerMachine.get(machine.id) ?? 0) + pct);
      });
    }

    // Fits on no compatible printer at all.
    for (const { part, bbox } of pending) {
      skipped.push({
        orderPartId: part.id,
        partName: part.name,
        orderId: part.orderId,
        reason: `Zu groß für alle passenden Drucker (${bbox.x}×${bbox.y}×${bbox.z} mm)`,
      });
    }
  }

  return { proposed: mergeMultiMaterialJobs(proposed, machines), skipped };
}

/**
 * On printers that hold several spools at once (AMS/MMU), separate single-spool
 * proposals for the same machine are merged into one job as long as the plate
 * and the number of slots allow it. Single-extruder printers (the default,
 * `materialSlots: 1`) are left untouched — mixing spools there would mean a
 * filament change in the middle of a print.
 */
function mergeMultiMaterialJobs(
  proposed: ProposedJob[],
  machines: Array<{ id: string; materialSlots: number; filamentSlots: { filamentId: string | null }[] }>
): ProposedJob[] {
  const slotsOf = (machineId: string) =>
    Math.max(1, machines.find((m) => m.id === machineId)?.materialSlots ?? 1);
  // Merging only pays off for spools the printer already holds — otherwise the
  // combined job would still need a filament change, just a bigger one.
  const loadedOn = (machineId: string) =>
    new Set(
      (machines.find((m) => m.id === machineId)?.filamentSlots ?? [])
        .map((fs) => fs.filamentId)
        .filter((id): id is string => id !== null)
    );

  const result: ProposedJob[] = [];
  const merged = new Set<number>();

  proposed.forEach((job, i) => {
    if (merged.has(i)) return;
    // Only fresh jobs are merged — an extend inherits the existing job's plate.
    if (job.type !== "new" || slotsOf(job.machineId) < 2) {
      result.push(job);
      return;
    }

    const slots = slotsOf(job.machineId);
    const loaded = loadedOn(job.machineId);
    if (!job.filamentIds.every((id) => loaded.has(id))) {
      result.push(job);
      return;
    }
    const target: ProposedNewJob = { ...job, parts: [...job.parts], filamentIds: [...job.filamentIds] };

    proposed.forEach((other, j) => {
      if (j <= i || merged.has(j)) return;
      if (other.type !== "new" || other.machineId !== target.machineId) return;

      if (!other.filamentIds.every((id) => loaded.has(id))) return;
      const spools = new Set([...target.filamentIds, ...other.filamentIds]);
      if (spools.size > slots) return;
      if (target.utilizationPct + other.utilizationPct > 70) return;

      target.parts.push(...other.parts);
      target.filamentIds = [...spools];
      target.utilizationPct += other.utilizationPct;
      target.estimatedGramsTotal =
        target.estimatedGramsTotal === null || other.estimatedGramsTotal === null
          ? null
          : target.estimatedGramsTotal + other.estimatedGramsTotal;
      target.filamentLabel = `${target.filamentLabel} + ${other.filamentLabel}`;
      target.insufficientFilament = target.insufficientFilament ?? other.insufficientFilament;
      merged.add(j);
    });

    result.push(target);
  });

  return result;
}
