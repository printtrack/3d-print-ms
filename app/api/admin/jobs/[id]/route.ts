import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { deductFilamentInventory, restoreFilamentInventory } from "@/lib/filament-inventory";
import { checkJobOverlap } from "@/lib/overlap-check";

const patchSchema = z.object({
  status: z.enum(["PLANNED", "SLICED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  machineId: z.string().min(1).optional(),
  queuePosition: z.number().int().min(0).optional(),
  plannedAt: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  printTimeMinutes: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const jobInclude = {
  machine: { select: { id: true, name: true } },
  parts: {
    include: {
      orderPart: {
        include: {
          order: { select: { id: true, customerName: true, customerEmail: true, description: true } },
          filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
        },
      },
    },
  },
  filamentUsages: {
    include: {
      filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
    },
  },
  files: { orderBy: { createdAt: "desc" as const } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.printJob.findUnique({
    where: { id },
    include: jobInclude,
  });

  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    // Fetch current job state once for guards that need it
    const current = await prisma.printJob.findUnique({
      where: { id },
      select: { status: true, printTimeFromGcode: true, machineId: true, plannedAt: true, printTimeMinutes: true },
    });
    const previousStatus = current?.status ?? null;

    if (data.machineId !== undefined) updateData.machineId = data.machineId;
    if (data.queuePosition !== undefined) updateData.queuePosition = data.queuePosition;
    if (data.plannedAt !== undefined) updateData.plannedAt = data.plannedAt ? new Date(data.plannedAt) : null;
    if (data.printTimeMinutes !== undefined) {
      if (!current?.printTimeFromGcode) {
        updateData.printTimeMinutes = data.printTimeMinutes;
      }
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Overlap check: run when plannedAt, machineId, or printTimeMinutes changes
    const schedulingChanged = data.plannedAt !== undefined || data.machineId !== undefined || data.printTimeMinutes !== undefined;
    const effectivePlannedAt = (data.plannedAt !== undefined ? (data.plannedAt ? new Date(data.plannedAt) : null) : current?.plannedAt) ?? null;
    if (schedulingChanged && effectivePlannedAt) {
      const effectiveMachineId = data.machineId ?? current?.machineId ?? "";
      const effectivePrintMinutes = data.printTimeMinutes !== undefined
        ? data.printTimeMinutes
        : (current?.printTimeMinutes ?? null);
      const overlap = await checkJobOverlap({
        machineId: effectiveMachineId,
        plannedAt: effectivePlannedAt,
        printTimeMinutes: effectivePrintMinutes,
        excludeJobId: id,
      });
      if (overlap.overlapping) {
        return NextResponse.json(
          { error: "Überschneidung mit einem anderen Druckauftrag", conflictJobId: overlap.conflictJobId },
          { status: 409 }
        );
      }
    }

    if (data.status !== undefined) {
      updateData.status = data.status;

      if (data.status === "IN_PROGRESS") {
        updateData.startedAt = data.startedAt ? new Date(data.startedAt) : new Date();
      }
      if (data.status === "DONE") {
        updateData.completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
      }
    }

    if (data.startedAt !== undefined && !updateData.startedAt) {
      updateData.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    }
    if (data.completedAt !== undefined && !updateData.completedAt) {
      updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }

    const job = await prisma.printJob.update({
      where: { id },
      data: updateData,
      include: jobInclude,
    });

    // Write audit logs for status transitions
    if (data.status && ["SLICED", "IN_PROGRESS", "DONE"].includes(data.status)) {
      const action = data.status === "SLICED" ? "JOB_SLICED" : data.status === "IN_PROGRESS" ? "JOB_STARTED" : "JOB_COMPLETED";
      const userId = (session.user as { id?: string })?.id ?? null;

      const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
      if (orderIds.length > 0) {
        await prisma.auditLog.createMany({
          data: orderIds.map((orderId) => ({
            orderId,
            userId,
            action,
            details: `Job ${id} auf ${job.machine.name}`,
          })),
        });
      }
    }

    // Inventory management on DONE transitions
    const warnings: string[] = [];
    if (data.status === "DONE" && previousStatus !== "DONE") {
      const inventoryWarnings = await deductFilamentInventory(id);
      warnings.push(...inventoryWarnings);
    } else if (data.status !== undefined && data.status !== "DONE" && previousStatus === "DONE") {
      await restoreFilamentInventory(id);
    }

    return NextResponse.json({ job, warnings });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  if (!["PLANNED", "SLICED", "CANCELLED"].includes(job.status)) {
    return NextResponse.json(
      { error: "Nur geplante, geslicte oder stornierte Jobs können gelöscht werden" },
      { status: 400 }
    );
  }

  await prisma.printJob.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
