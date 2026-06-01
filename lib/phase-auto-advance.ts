import { prisma } from "@/lib/db";
import {
  evaluateOrderAutoAdvance,
  evaluateOrderEnterGate,
  evaluatePartAutoAdvance,
  evaluatePartEnterGate,
  parseOrderConditions,
  parsePartConditions,
  orderConditionLabelKey,
  partConditionLabelKey,
} from "@/lib/phase-conditions";
import { sendPhaseChangeEmail } from "@/lib/email";
import { publish } from "@/lib/event-bus";

const MAX_DEPTH = 5;

export interface AutoAdvanceResult {
  advanced: boolean;
  hops: number;
  finalPhaseId?: string;
}

/**
 * Evaluate the autoAdvance conditions of the order's CURRENT phase. If all
 * met AND the NEXT phase's enterGate is also met, move the order forward.
 * Recurses (up to MAX_DEPTH) so a chain of satisfied auto-advances all fire
 * in one event without waiting for another trigger.
 *
 * Audit-Log entries are written with `userId: null` so manual changes stay
 * attributable.
 */
export async function runOrderAutoAdvance(
  orderId: string,
  _depth = 0
): Promise<AutoAdvanceResult> {
  if (_depth >= MAX_DEPTH) return { advanced: _depth > 0, hops: _depth };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      phaseId: true,
      customerEmail: true,
      customerName: true,
      trackingToken: true,
      archivedAt: true,
      phase: { select: { id: true, name: true, position: true, autoAdvance: true } },
    },
  });
  if (!order || order.archivedAt) return { advanced: _depth > 0, hops: _depth };

  const conditions = parseOrderConditions(order.phase.autoAdvance);
  if (conditions.length === 0) return { advanced: _depth > 0, hops: _depth };

  const ready = await evaluateOrderAutoAdvance(orderId, order.phase.id);
  if (!ready.ok) return { advanced: _depth > 0, hops: _depth };

  const nextPhase = await prisma.orderPhase.findFirst({
    where: { position: { gt: order.phase.position } },
    orderBy: { position: "asc" },
  });
  if (!nextPhase) return { advanced: _depth > 0, hops: _depth };

  // Gate of the next phase must also be met — auto-advance never sneaks past a gate.
  const gate = await evaluateOrderEnterGate(orderId, nextPhase.id);
  if (!gate.ok) return { advanced: _depth > 0, hops: _depth };

  const conditionLabels = conditions.map((c) => orderConditionLabelKey(c)).join(", ");
  const archiveSuffix = nextPhase.isArchive ? " — Auftrag archiviert" : "";

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        phaseId: nextPhase.id,
        ...(nextPhase.isArchive ? { archivedAt: new Date() } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        userId: null,
        action: "PHASE_CHANGED",
        details: `Phase: ${nextPhase.name} (auto-advance: ${conditionLabels})${archiveSuffix}`,
      },
    }),
  ]);

  // Email + survey side-effects mirror the manual PATCH route. Survey is
  // intentionally NOT triggered here — it requires an explicit settings flag
  // and the manual path already handles it. Auto-advance just moves + emails.
  sendPhaseChangeEmail({
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    phaseName: nextPhase.name,
    trackingToken: order.trackingToken,
  }).catch((err) => console.error("[phase-auto-advance] email failed:", err));

  publish({ type: "order.changed", orderId });

  // Recurse — the new phase may itself have a satisfied auto-advance.
  const next = await runOrderAutoAdvance(orderId, _depth + 1);
  return { advanced: true, hops: next.hops + 1, finalPhaseId: next.finalPhaseId ?? nextPhase.id };
}

/** Fire-and-forget wrapper: log failures, never throw to callers. */
export function triggerOrderAutoAdvance(orderId: string): void {
  runOrderAutoAdvance(orderId).catch((err) =>
    console.error(`[phase-auto-advance] order ${orderId} failed:`, err)
  );
}

// ─────────────────────────────────────────────────────────────────
// Part-level
// ─────────────────────────────────────────────────────────────────

export async function runPartAutoAdvance(
  partId: string,
  _depth = 0
): Promise<AutoAdvanceResult> {
  if (_depth >= MAX_DEPTH) return { advanced: _depth > 0, hops: _depth };

  const part = await prisma.orderPart.findUnique({
    where: { id: partId },
    select: {
      id: true,
      partPhaseId: true,
      partPhase: { select: { id: true, position: true, autoAdvance: true } },
    },
  });
  if (!part || !part.partPhase) return { advanced: _depth > 0, hops: _depth };

  const conditions = parsePartConditions(part.partPhase.autoAdvance);
  if (conditions.length === 0) return { advanced: _depth > 0, hops: _depth };

  const ready = await evaluatePartAutoAdvance(partId, part.partPhase.id);
  if (!ready.ok) return { advanced: _depth > 0, hops: _depth };

  const nextPhase = await prisma.partPhase.findFirst({
    where: { position: { gt: part.partPhase.position } },
    orderBy: { position: "asc" },
  });
  if (!nextPhase) return { advanced: _depth > 0, hops: _depth };

  const gate = await evaluatePartEnterGate(partId, nextPhase.id);
  if (!gate.ok) return { advanced: _depth > 0, hops: _depth };

  const labels = conditions.map((c) => partConditionLabelKey(c)).join(", ");

  await prisma.orderPart.update({
    where: { id: partId },
    data: { partPhaseId: nextPhase.id },
  });

  // Audit-log on the parent order so it surfaces in the order timeline.
  const partWithOrder = await prisma.orderPart.findUnique({
    where: { id: partId },
    select: { orderId: true, name: true },
  });
  if (partWithOrder) {
    await prisma.auditLog.create({
      data: {
        orderId: partWithOrder.orderId,
        userId: null,
        action: "PART_PHASE_CHANGED",
        details: `Part "${partWithOrder.name}" → ${nextPhase.name} (auto-advance: ${labels})`,
      },
    });
    publish({ type: "order.changed", orderId: partWithOrder.orderId });
  }

  const next = await runPartAutoAdvance(partId, _depth + 1);
  return { advanced: true, hops: next.hops + 1, finalPhaseId: next.finalPhaseId ?? nextPhase.id };
}

export function triggerPartAutoAdvance(partId: string): void {
  runPartAutoAdvance(partId).catch((err) =>
    console.error(`[phase-auto-advance] part ${partId} failed:`, err)
  );
}

/**
 * Page-load fallback: sweep all non-archived orders whose current phase has
 * a "days_in_phase" auto-advance configured. Time-based conditions need this
 * because no event fires from time passing.
 */
export async function runDaysInPhaseAutoAdvanceSweep(): Promise<{ checked: number; advanced: number }> {
  const phases = await prisma.orderPhase.findMany({
    select: { id: true, autoAdvance: true },
  });
  const timeBasedPhaseIds = phases
    .filter((p) => parseOrderConditions(p.autoAdvance).some((c) => c.type === "days_in_phase"))
    .map((p) => p.id);

  if (timeBasedPhaseIds.length === 0) return { checked: 0, advanced: 0 };

  const orders = await prisma.order.findMany({
    where: { phaseId: { in: timeBasedPhaseIds }, archivedAt: null },
    select: { id: true },
  });

  let advanced = 0;
  for (const o of orders) {
    const res = await runOrderAutoAdvance(o.id).catch(() => null);
    if (res?.advanced) advanced++;
  }
  return { checked: orders.length, advanced };
}
