import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkJobOverlap } from "@/lib/overlap-check";
import { publish } from "@/lib/event-bus";
import { triggerOrderAutoAdvance, triggerPartAutoAdvance } from "@/lib/phase-auto-advance";
import { resolveFilamentForPart, partPrintableOnMachine } from "@/lib/filament-resolve";

const patchSchema = z.object({
  status: z.enum(["PLANNED", "SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION", "DONE", "CANCELLED"]).optional(),
  machineId: z.string().min(1).optional(),
  queuePosition: z.number().int().min(0).optional(),
  plannedAt: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  printTimeMinutes: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const jobInclude = {
  machine: { select: { id: true, name: true } },
  parts: {
    include: {
      orderPart: {
        include: {
          order: { select: { id: true, customerName: true, customerEmail: true, description: true, isPrototype: true } },
          files: { select: { id: true, filename: true, originalName: true, mimeType: true, orderId: true } },
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
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

// Attach the resolved spool price (material+color) to each part for the verify
// cost preview, since parts no longer point at a concrete filament.
type JobWithParts = { parts: Array<{ orderPart: { material: string | null; materialAny: boolean; color: string | null; colorAny: boolean } & Record<string, unknown> } & Record<string, unknown>> } & Record<string, unknown>;
async function attachPartPrices<T extends JobWithParts>(job: T): Promise<T> {
  const inventory = await prisma.filament.findMany({
    select: { material: true, color: true, isActive: true, remainingGrams: true, pricePerKg: true },
  });
  return {
    ...job,
    parts: job.parts.map((p) => {
      const resolved = resolveFilamentForPart(p.orderPart, inventory);
      return { ...p, orderPart: { ...p.orderPart, pricePerKg: resolved?.pricePerKg != null ? resolved.pricePerKg.toString() : null } };
    }),
  };
}

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
  return NextResponse.json(await attachPartPrices(job));
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

    if (data.assigneeIds !== undefined) {
      await prisma.printJobAssignee.deleteMany({ where: { printJobId: id } });
      if (data.assigneeIds.length > 0) {
        await prisma.printJobAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ printJobId: id, userId })),
        });
      }
    }

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

    // Filament–machine compatibility: block moving a job to a machine that
    // can't print one of its parts' material/color (e.g. TPU-only spool).
    if (data.machineId !== undefined && data.machineId !== current?.machineId) {
      const [jobParts, filaments, target] = await Promise.all([
        prisma.printJobPart.findMany({
          where: { printJobId: id },
          select: { orderPart: { select: { name: true, material: true, materialAny: true, color: true, colorAny: true } } },
        }),
        prisma.filament.findMany({ include: { compatibleMachines: { select: { id: true } } } }),
        prisma.machine.findUnique({ where: { id: data.machineId }, select: { name: true } }),
      ]);
      const inv = filaments.map((f) => ({
        material: f.material,
        color: f.color,
        compatibleMachineIds: f.compatibleMachines.map((m) => m.id),
      }));
      const blocked = jobParts.find((jp) => !partPrintableOnMachine(jp.orderPart, inv, data.machineId!));
      if (blocked) {
        return NextResponse.json(
          { error: `Teil „${blocked.orderPart.name}" ist nicht mit Drucker „${target?.name ?? ""}" kompatibel` },
          { status: 422 }
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
    if (data.status && ["SLICED", "IN_PROGRESS", "AWAITING_VERIFICATION", "DONE"].includes(data.status)) {
      const action = data.status === "SLICED" ? "JOB_SLICED" : data.status === "IN_PROGRESS" ? "JOB_STARTED" : data.status === "AWAITING_VERIFICATION" ? "JOB_AWAITING_VERIFICATION" : "JOB_COMPLETED";
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

    publish({ type: "job.changed", jobId: id });

    // Fire phase auto-advance for orders + parts touched by this job, but only
    // when the status transition could plausibly satisfy a condition (DONE / CANCELLED).
    if (data.status && (data.status === "DONE" || data.status === "CANCELLED")) {
      const orderIds = [...new Set(job.parts.map((p) => p.orderPart.orderId))];
      const partIds = [...new Set(job.parts.map((p) => p.orderPart.id))];
      orderIds.forEach((oid) => triggerOrderAutoAdvance(oid));
      partIds.forEach((pid) => triggerPartAutoAdvance(pid));
    }

    return NextResponse.json({ job: await attachPartPrices(job), warnings: [] });
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
  // AWAITING_VERIFICATION is implicitly blocked by the check above (not in allowed list)

  await prisma.printJob.delete({ where: { id } });
  publish({ type: "job.changed", jobId: id });
  return NextResponse.json({ success: true });
}
