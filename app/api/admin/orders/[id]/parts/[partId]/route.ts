import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { z } from "zod";
import { maybeAutoSendPartDesignVerification } from "@/lib/design-verification";
import { evaluatePartEnterGate } from "@/lib/phase-conditions";
import { triggerOrderAutoAdvance, triggerPartAutoAdvance } from "@/lib/phase-auto-advance";
import { parseAxis, deriveColorHex } from "@/lib/filament-resolve";
import { replanParts } from "@/lib/job-replan";
import { triggerAutoPlan } from "@/lib/job-auto-plan";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  // Wire format per axis: concrete name | "ANY" (egal) | null (unset)
  material: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  gramsEstimated: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).optional(),
  partPhaseId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  overrideReason: z.string().min(5).max(500).optional(),
});

const partInclude = {
  partPhase: { select: { id: true, name: true, color: true, isPrintReady: true, isReview: true, isPrinted: true, isMisprint: true } },
  files: true,
  printJobParts: {
    include: { printJob: { select: { id: true, status: true, machine: { select: { name: true } } } } },
  },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const { id, partId } = await params;

  const guard = await assertOrderAccess(id, "orders.edit");
  if (guard) return guard;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const currentPart = await prisma.orderPart.findUnique({
      where: { id: partId, orderId: id },
      include: { assignees: { select: { userId: true } } },
    });
    if (!currentPart) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (data.assigneeIds !== undefined) {
      await prisma.orderPartAssignee.deleteMany({ where: { orderPartId: partId } });
      if (data.assigneeIds.length > 0) {
        await prisma.orderPartAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ orderPartId: partId, userId })),
        });
      }
    }

    // Block transition to isPrintReady phase if there's a pending design review for this part
    if (data.partPhaseId) {
      const newPhase = await prisma.partPhase.findUnique({ where: { id: data.partPhaseId } });
      if (newPhase?.isPrintReady) {
        const pendingReview = await prisma.verificationRequest.findFirst({
          where: { orderId: id, orderPartId: partId, type: "DESIGN_REVIEW", status: "PENDING" },
        });
        if (pendingReview) {
          return NextResponse.json(
            { error: "Designfreigabe muss erst erteilt werden" },
            { status: 409 }
          );
        }
      }

      // Per-phase enterGate for parts
      if (data.partPhaseId !== currentPart.partPhaseId) {
        const gate = await evaluatePartEnterGate(partId, data.partPhaseId);
        if (!gate.ok && !data.overrideReason) {
          return NextResponse.json(
            {
              error: "Gate-Bedingungen nicht erfüllt",
              code: "PHASE_GATE",
              requiresOverride: true,
              reasonKeys: gate.blockedReasons,
            },
            { status: 422 }
          );
        }
      }
    }

    // Material / color requirement updates (independent axes, "ANY" = egal).
    const mat = parseAxis(data.material);
    const col = parseAxis(data.color);
    let colorHexUpdate: { colorHex: string | null } | undefined;
    if (col !== undefined) {
      if (col.concrete) {
        const matForHex = mat !== undefined ? mat.concrete : currentPart.material;
        const filaments = await prisma.filament.findMany({
          select: { material: true, color: true, colorHex: true },
        });
        colorHexUpdate = { colorHex: deriveColorHex(matForHex, col.concrete, filaments) };
      } else {
        colorHexUpdate = { colorHex: null };
      }
    }

    const part = await prisma.orderPart.update({
      where: { id: partId, orderId: id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(mat !== undefined ? { material: mat.concrete, materialAny: mat.any } : {}),
        ...(col !== undefined ? { color: col.concrete, colorAny: col.any } : {}),
        ...(colorHexUpdate ?? {}),
        ...(data.gramsEstimated !== undefined ? { gramsEstimated: data.gramsEstimated } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.partPhaseId !== undefined ? { partPhaseId: data.partPhaseId } : {}),
      },
      include: partInclude,
    });

    // Auto-send per-part design verification when entering review phase (non-prototype only)
    if (data.partPhaseId && part.partPhase?.isReview) {
      const order = await prisma.order.findUnique({ where: { id }, select: { isPrototype: true } });
      if (!order?.isPrototype) {
        await maybeAutoSendPartDesignVerification(id, partId);
      }
    }

    const userId = (await getActor())?.id ?? null;

    if (data.assigneeIds !== undefined) {
      const oldIds = new Set(currentPart.assignees.map((a) => a.userId));
      const newIds = new Set(data.assigneeIds);
      const added = data.assigneeIds.filter((uid) => !oldIds.has(uid));
      const removed = [...oldIds].filter((uid) => !newIds.has(uid));

      if (added.length > 0 || removed.length > 0) {
        const addedUsers = await prisma.user.findMany({ where: { id: { in: added } }, select: { name: true } });
        const removedUsers = await prisma.user.findMany({ where: { id: { in: removed } }, select: { name: true } });
        const parts: string[] = [];
        if (addedUsers.length > 0) parts.push(`Hinzugefügt: ${addedUsers.map((u) => u.name).join(", ")}`);
        if (removedUsers.length > 0) parts.push(`Entfernt: ${removedUsers.map((u) => u.name).join(", ")}`);
        if (newIds.size === 0) { parts.length = 0; parts.push("Zuweisung entfernt"); }

        await prisma.auditLog.create({
          data: {
            orderId: id,
            userId,
            action: "PART_ASSIGNED",
            details: `Teil "${part.name}": ${parts.join("; ")}`,
          },
        });
      }
    } else {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId,
          action: "PART_UPDATED",
          details: `Teil "${part.name}" aktualisiert`,
        },
      });
    }

    // If part-phase changed, fire auto-advance for the part and its parent order.
    if (data.partPhaseId !== undefined && data.partPhaseId !== currentPart.partPhaseId) {
      triggerPartAutoAdvance(partId);
      triggerOrderAutoAdvance(id);
    }

    // Spec changes invalidate an already planned slot: pull the part out of its
    // open job so the auto-planner can re-batch it (running prints stay as they are).
    const replanReasons: string[] = [];
    if (mat !== undefined && (mat.concrete !== currentPart.material || mat.any !== currentPart.materialAny)) {
      replanReasons.push("Material geändert");
    }
    if (col !== undefined && (col.concrete !== currentPart.color || col.any !== currentPart.colorAny)) {
      replanReasons.push("Farbe geändert");
    }
    if (data.quantity !== undefined && data.quantity !== currentPart.quantity) {
      replanReasons.push("Menge geändert");
    }
    if (
      data.partPhaseId !== undefined &&
      data.partPhaseId !== currentPart.partPhaseId &&
      !part.partPhase?.isPrintReady &&
      !part.partPhase?.isMisprint
    ) {
      replanReasons.push("nicht mehr druckbereit");
    }
    if (replanReasons.length > 0) {
      await replanParts([partId], replanReasons.join(", "), userId);
    } else if (
      data.partPhaseId !== undefined &&
      data.partPhaseId !== currentPart.partPhaseId &&
      (part.partPhase?.isPrintReady || part.partPhase?.isMisprint)
    ) {
      // Print-ready parts are planned right away instead of waiting for the
      // next visit to the jobs board.
      triggerAutoPlan(userId);
    }

    return NextResponse.json(part);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const { id, partId } = await params;

  const guard = await assertOrderAccess(id, "orders.edit");
  if (guard) return guard;

  const part = await prisma.orderPart.findUnique({ where: { id: partId, orderId: id } });
  if (!part) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.orderPart.delete({ where: { id: partId } });

  await prisma.auditLog.create({
    data: {
      orderId: id,
      userId: (await getActor())?.id ?? null,
      action: "PART_REMOVED",
      details: `Teil "${part.name}" entfernt`,
    },
  });

  return NextResponse.json({ success: true });
}
