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
  filamentId: string;
  filamentLabel: string;
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

function packGroup(
  parts: Array<{ part: PartWithRelations; bbox: { x: number; y: number; z: number } }>,
  machine: { id: string; name: string; buildVolumeX: number; buildVolumeY: number; buildVolumeZ: number },
  skipped: SkippedPart[],
  existingUsedArea = 0
): Array<{ batch: typeof parts; usedArea: number; gramsTotal: number | null }> {
  const build = { x: machine.buildVolumeX, y: machine.buildVolumeY, z: machine.buildVolumeZ };
  const bedArea = build.x * build.y;

  const eligible: Array<{
    part: PartWithRelations;
    bbox: { x: number; y: number; z: number };
    orientation: { width: number; depth: number; height: number };
    footprint: number;
  }> = [];

  for (const { part, bbox } of parts) {
    const q = { qx: part.orientQx, qy: part.orientQy, qz: part.orientQz, qw: part.orientQw };
    let orientation: { width: number; depth: number; height: number } | null;

    if (!isIdentityQuaternion(q)) {
      // User picked a face — use the rotated bbox (Z is the print height in Z-up convention)
      const rotatedBbox = applyQuaternionToBbox(bbox, q);
      const w = Math.min(rotatedBbox.x, rotatedBbox.y);
      const d = Math.max(rotatedBbox.x, rotatedBbox.y);
      const h = rotatedBbox.z;
      if (h > build.z || (w > build.x && w > build.y) || (d > build.x && d > build.y)) {
        skipped.push({
          orderPartId: part.id,
          partName: part.name,
          reason: `Zu groß für Maschine "${machine.name}" in gewählter Orientierung (${rotatedBbox.x}×${rotatedBbox.y}×${rotatedBbox.z} mm)`,
        });
        continue;
      }
      orientation = { width: w, depth: d, height: h };
    } else {
      orientation = pickPrintOrientation(bbox, build);
      if (!orientation) {
        skipped.push({
          orderPartId: part.id,
          partName: part.name,
          reason: `Zu groß für Maschine "${machine.name}" (${bbox.x}×${bbox.y}×${bbox.z} mm)`,
        });
        continue;
      }
    }

    eligible.push({ part, bbox, orientation, footprint: orientation.width * orientation.depth });
  }

  eligible.sort((a, b) => b.footprint - a.footprint);

  const batches: Array<{ batch: typeof eligible; usedArea: number; gramsTotal: number | null }> = [];
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
      for (const item of remaining) {
        skipped.push({
          orderPartId: item.part.id,
          partName: item.part.name,
          reason: `Teil passt nicht auf Bauplatte von Maschine "${machine.name}"`,
        });
      }
      break;
    }

    let gramsTotal: number | null = 0;
    for (const { part } of batch) {
      if (part.gramsEstimated === null) { gramsTotal = null; break; }
      gramsTotal += part.gramsEstimated * part.quantity;
    }

    batches.push({ batch, usedArea: usedArea - (firstBatch ? existingUsedArea : 0), gramsTotal });
    remaining = leftover;
    firstBatch = false;
  }

  return batches;
}

export async function plan(): Promise<{ proposed: ProposedJob[]; skipped: SkippedPart[] }> {
  const [parts, activeMachines, rawFilaments, reservedByPool, downMachineIds] = await Promise.all([
    getPrintReadyParts(),
    prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
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
  const resolvePart = (
    part: PartWithRelations,
    preferIds?: Set<string>
  ): PlannerFilament | { skip: string } => {
    const matSet = part.materialAny || !!part.material;
    const colSet = part.colorAny || !!part.color;
    if (!matSet) return { skip: "Material nicht festgelegt" };
    if (!colSet) return { skip: "Farbe nicht festgelegt" };
    const axisMatches = activeFilaments.filter((f) => matchesAxes(f, part));
    if (axisMatches.length === 0) return { skip: "Kein passendes Filament auf Lager" };
    const compatMatches = axisMatches.filter((f) => machinesCompatibleWith(f).length > 0);
    if (compatMatches.length === 0) return { skip: "Kein kompatibler Drucker verfügbar" };
    if (preferIds) {
      const anchor = compatMatches.find((f) => preferIds.has(f.id));
      if (anchor) return anchor;
    }
    return [...compatMatches].sort((a, b) => b.remainingGrams - a.remainingGrams)[0];
  };

  // Load existing PLANNED, not-yet-scheduled jobs to prefer extending them.
  const existingPlannedJobs = await prisma.printJob.findMany({
    where: { status: "PLANNED", plannedAt: null },
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

  // --- Two-pass resolution: pin each plannable part to a concrete spool -------
  const resolvedByPart = new Map<string, PlannerFilament>();
  const anchors = new Set<string>();

  // Pass 1: fully concrete parts (specific material AND color) seed the anchors.
  for (const part of parts) {
    if (part.material && !part.materialAny && part.color && !part.colorAny) {
      const r = resolvePart(part);
      if (!("skip" in r)) {
        resolvedByPart.set(part.id, r);
        anchors.add(r.id);
      }
    }
  }
  // Pass 2: everything else, preferring an anchor spool to fill an existing bed.
  for (const part of parts) {
    if (resolvedByPart.has(part.id)) continue;
    const r = resolvePart(part, anchors);
    if ("skip" in r) {
      skipped.push({ orderPartId: part.id, partName: part.name, reason: r.skip });
    } else {
      resolvedByPart.set(part.id, r);
    }
  }

  // --- Group resolved parts by concrete spool, resolving bboxes --------------
  const groups = new Map<string, { filament: PlannerFilament; items: Array<{ part: PartWithRelations; bbox: { x: number; y: number; z: number } }> }>();

  await Promise.all(
    parts.map(async (part) => {
      const filament = resolvedByPart.get(part.id);
      if (!filament) return; // already skipped
      const bbox = await ensureBboxCached(part);
      if (!bbox) {
        skipped.push({ orderPartId: part.id, partName: part.name, reason: "Keine STL-Datei gefunden" });
        return;
      }
      const g = groups.get(filament.id) ?? { filament, items: [] };
      g.items.push({ part, bbox });
      groups.set(filament.id, g);
    })
  );

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

  let machineIdx = 0;

  for (const [filamentId, group] of groups.entries()) {
    const filament = group.filament;
    const compatList = machinesCompatibleWith(filament);
    if (compatList.length === 0) {
      for (const { part } of group.items) {
        skipped.push({ orderPartId: part.id, partName: part.name, reason: "Kein kompatibler Drucker verfügbar" });
      }
      continue;
    }

    // Prefer the machine of an existing job using this spool, if it's compatible.
    const existingJobForFilament = existingJobByFilamentId.get(filamentId);
    let machine =
      existingJobForFilament && compatList.some((m) => m.id === existingJobForFilament.machineId)
        ? compatList.find((m) => m.id === existingJobForFilament.machineId)!
        : compatList[machineIdx % compatList.length];
    if (!existingJobForFilament) machineIdx++;

    const bedArea = machine.buildVolumeX * machine.buildVolumeY;
    const filamentLabel = filamentLabelOf(filament);

    // Existing job on the chosen machine that already uses this spool → extend it.
    const matchingExistingJob = existingPlannedJobs.find(
      (j) =>
        j.machineId === machine.id &&
        j.parts.some((pjp) => {
          const r = resolvePart(pjp.orderPart as unknown as PartWithRelations);
          return !("skip" in r) && r.id === filamentId;
        })
    );

    const usedArea = matchingExistingJob ? existingJobUsedArea.get(matchingExistingJob.id) ?? 0 : 0;
    const batches = packGroup(group.items, machine, skipped, usedArea);
    if (batches.length === 0) continue;

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
          parts: partsPayload,
          utilizationPct: Math.round((batch.usedArea / bedArea) * 100),
          estimatedGramsTotal: batch.gramsTotal,
          insufficientFilament: checkSufficiency(filament, batch.gramsTotal),
        });
      }
      recordProposed(filament, batch.gramsTotal);
    });
  }

  return { proposed, skipped };
}
