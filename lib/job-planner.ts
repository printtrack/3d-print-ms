import fs from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { computeBbox, pickPrintOrientation } from "./stl-bbox";
import { getUploadDir } from "./uploads";

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
      partPhase: { isPrintReady: true },
      printJobParts: {
        none: { printJob: { status: { notIn: ["DONE", "CANCELLED"] } } },
      },
    },
    include: {
      filament: true,
      order: { select: { id: true } },
    },
  });
}

async function findStlFile(part: PartWithRelations) {
  const allFiles = await prisma.orderFile.findMany({
    where: {
      orderId: part.orderId,
      OR: [
        { orderPartId: part.id },
        { orderPartId: null },
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

function materialKey(filament: { material: string; colorHex: string | null; color: string }): string {
  return `${filament.material.toLowerCase()}|${(filament.colorHex ?? filament.color).toLowerCase()}`;
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
    const orientation = pickPrintOrientation(bbox, build);
    if (!orientation) {
      skipped.push({
        orderPartId: part.id,
        partName: part.name,
        reason: `Zu groß für Maschine "${machine.name}" (${bbox.x}×${bbox.y}×${bbox.z} mm)`,
      });
      continue;
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
  const [parts, machines] = await Promise.all([
    getPrintReadyParts(),
    prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (machines.length === 0) return { proposed: [], skipped: [] };

  // Load existing PLANNED jobs with no plannedAt (not yet scheduled)
  const existingPlannedJobs = await prisma.printJob.findMany({
    where: { status: "PLANNED", plannedAt: null },
    include: {
      machine: true,
      parts: {
        include: {
          orderPart: {
            select: { id: true, bboxXmm: true, bboxYmm: true, bboxZmm: true, gramsEstimated: true, quantity: true, filamentId: true },
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
      if (p.bboxXmm && p.bboxYmm) {
        used += p.bboxXmm * p.bboxYmm * p.quantity;
      }
    }
    existingJobUsedArea.set(job.id, Math.min(used, bedArea * 0.7));
  }

  const skipped: SkippedPart[] = [];
  const proposed: ProposedJob[] = [];

  // Resolve bboxes and group by material
  const groups = new Map<string, Array<{ part: PartWithRelations; bbox: { x: number; y: number; z: number } }>>();

  await Promise.all(
    parts.map(async (part) => {
      if (!part.filament) {
        skipped.push({ orderPartId: part.id, partName: part.name, reason: "Kein Filament zugewiesen" });
        return;
      }
      const bbox = await ensureBboxCached(part);
      if (!bbox) {
        skipped.push({ orderPartId: part.id, partName: part.name, reason: "Keine STL-Datei gefunden" });
        return;
      }
      const key = materialKey(part.filament);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ part, bbox });
    })
  );

  let machineIdx = 0;

  for (const groupParts of groups.values()) {
    const machine = machines[machineIdx % machines.length];
    machineIdx++;

    const filament = groupParts[0].part.filament!;
    const build = { x: machine.buildVolumeX, y: machine.buildVolumeY, z: machine.buildVolumeZ };
    const bedArea = build.x * build.y;

    // Find an existing PLANNED job on this machine with matching filament
    const matchingExistingJob = existingPlannedJobs.find(
      (j) =>
        j.machineId === machine.id &&
        j.parts.some((pjp) => pjp.orderPart.filamentId === filament.id)
    );

    if (matchingExistingJob) {
      const usedArea = existingJobUsedArea.get(matchingExistingJob.id) ?? 0;
      const batches = packGroup(groupParts, machine, skipped, usedArea);

      if (batches.length > 0) {
        const [firstBatch, ...rest] = batches;
        const filamentLabel = `${filament.material} ${filament.color}${filament.name ? ` (${filament.name})` : ""}`;

        proposed.push({
          type: "extend",
          existingJobId: matchingExistingJob.id,
          machineId: machine.id,
          machineName: machine.name,
          filamentId: filament.id,
          filamentLabel,
          parts: firstBatch.batch.map(({ part }) => ({
            orderPartId: part.id,
            partName: part.name,
            orderId: part.order.id,
            quantity: part.quantity,
          })),
          addedGramsTotal: firstBatch.gramsTotal,
        });

        for (const batch of rest) {
          proposed.push({
            type: "new",
            machineId: machine.id,
            machineName: machine.name,
            filamentId: filament.id,
            filamentLabel,
            parts: batch.batch.map(({ part }) => ({
              orderPartId: part.id,
              partName: part.name,
              orderId: part.order.id,
              quantity: part.quantity,
            })),
            utilizationPct: Math.round((batch.usedArea / bedArea) * 100),
            estimatedGramsTotal: batch.gramsTotal,
          });
        }
      }
    } else {
      const batches = packGroup(groupParts, machine, skipped, 0);
      const filamentLabel = `${filament.material} ${filament.color}${filament.name ? ` (${filament.name})` : ""}`;

      for (const batch of batches) {
        proposed.push({
          type: "new",
          machineId: machine.id,
          machineName: machine.name,
          filamentId: filament.id,
          filamentLabel,
          parts: batch.batch.map(({ part }) => ({
            orderPartId: part.id,
            partName: part.name,
            orderId: part.order.id,
            quantity: part.quantity,
          })),
          utilizationPct: Math.round((batch.usedArea / bedArea) * 100),
          estimatedGramsTotal: batch.gramsTotal,
        });
      }
    }
  }

  return { proposed, skipped };
}
