import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────
// Condition catalog — closed union, no free-form DSL
// ─────────────────────────────────────────────────────────────────

export const partPhaseFlagSchema = z.enum(["isPrintReady", "isPrinted", "isMisprint"]);
export type PartPhaseFlag = z.infer<typeof partPhaseFlagSchema>;

export const orderConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all_parts_in_phase_with_flag"), flag: partPhaseFlagSchema }),
  z.object({ type: z.literal("all_jobs_done") }),
  z.object({ type: z.literal("quote_approved") }),
  z.object({ type: z.literal("invoice_paid") }),
  z.object({ type: z.literal("verification_complete") }),
  z.object({ type: z.literal("survey_submitted") }),
  z.object({ type: z.literal("days_in_phase"), days: z.number().int().min(1).max(365) }),
]);
export type OrderCondition = z.infer<typeof orderConditionSchema>;

export const partConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("part_all_jobs_done") }),
  z.object({ type: z.literal("part_assigned_to_job") }),
  z.object({ type: z.literal("part_days_in_phase"), days: z.number().int().min(1).max(365) }),
]);
export type PartCondition = z.infer<typeof partConditionSchema>;

export const orderConditionsSchema = z.array(orderConditionSchema);
export const partConditionsSchema = z.array(partConditionSchema);

// Safely coerce DB Json into a typed condition array (returns [] on garbage).
export function parseOrderConditions(value: Prisma.JsonValue | null | undefined): OrderCondition[] {
  if (!value) return [];
  const parsed = orderConditionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parsePartConditions(value: Prisma.JsonValue | null | undefined): PartCondition[] {
  if (!value) return [];
  const parsed = partConditionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

// ─────────────────────────────────────────────────────────────────
// Reason keys — surfaced to UI via i18n
// ─────────────────────────────────────────────────────────────────

export type ReasonKey =
  | "phase_reason_parts_not_print_ready"
  | "phase_reason_parts_not_printed"
  | "phase_reason_parts_not_misprint"
  | "phase_reason_jobs_not_done"
  | "phase_reason_quote_not_approved"
  | "phase_reason_invoice_not_paid"
  | "phase_reason_verification_pending"
  | "phase_reason_survey_not_submitted"
  | "phase_reason_days_in_phase"
  | "phase_reason_part_jobs_not_done"
  | "phase_reason_part_not_assigned_to_job"
  | "phase_reason_part_days_in_phase";

export interface EvaluatedReason {
  key: ReasonKey;
  params?: Record<string, string | number>;
}

const FLAG_TO_REASON: Record<PartPhaseFlag, ReasonKey> = {
  isPrintReady: "phase_reason_parts_not_print_ready",
  isPrinted: "phase_reason_parts_not_printed",
  isMisprint: "phase_reason_parts_not_misprint",
};

// ─────────────────────────────────────────────────────────────────
// Order-level evaluators
// ─────────────────────────────────────────────────────────────────

async function lastPhaseChangeAt(orderId: string): Promise<Date | null> {
  const log = await prisma.auditLog.findFirst({
    where: { orderId, action: "PHASE_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  return log?.createdAt ?? null;
}

async function evaluateOrderCondition(
  cond: OrderCondition,
  orderId: string
): Promise<{ ok: boolean; reason?: EvaluatedReason }> {
  switch (cond.type) {
    case "all_parts_in_phase_with_flag": {
      const flag = cond.flag;
      const parts = await prisma.orderPart.findMany({
        where: { orderId },
        select: { partPhase: { select: { [flag]: true } } },
      });
      if (parts.length === 0) return { ok: false, reason: { key: FLAG_TO_REASON[flag] } };
      const ok = parts.every((p) => p.partPhase && (p.partPhase as Record<string, unknown>)[flag] === true);
      return ok ? { ok: true } : { ok: false, reason: { key: FLAG_TO_REASON[flag] } };
    }
    case "all_jobs_done": {
      const jobParts = await prisma.printJobPart.findMany({
        where: { orderPart: { orderId } },
        select: { printJob: { select: { status: true } } },
      });
      if (jobParts.length === 0)
        return { ok: false, reason: { key: "phase_reason_jobs_not_done" } };
      const ok = jobParts.every(
        (jp) => jp.printJob.status === "DONE" || jp.printJob.status === "CANCELLED"
      );
      return ok ? { ok: true } : { ok: false, reason: { key: "phase_reason_jobs_not_done" } };
    }
    case "quote_approved": {
      // Permissive semantics: no quote at all → not applicable, pass.
      // A quote is only blocking when it has been started (DRAFT/SENT) but
      // not yet APPROVED — same rule as the legacy shouldGateOnQuote.
      const anyQuote = await prisma.quote.findFirst({
        where: { orderId, status: { in: ["DRAFT", "SENT", "APPROVED"] } },
        select: { status: true },
      });
      if (!anyQuote) return { ok: true };
      const approved = await prisma.quote.findFirst({ where: { orderId, status: "APPROVED" } });
      return approved
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_quote_not_approved" } };
    }
    case "invoice_paid": {
      const inv = await prisma.invoice.findFirst({ where: { orderId, status: "PAID" } });
      return inv ? { ok: true } : { ok: false, reason: { key: "phase_reason_invoice_not_paid" } };
    }
    case "verification_complete": {
      const pending = await prisma.verificationRequest.count({
        where: { orderId, status: "PENDING" },
      });
      return pending === 0
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_verification_pending" } };
    }
    case "survey_submitted": {
      const sr = await prisma.surveyResponse.findUnique({ where: { orderId } });
      return sr?.submittedAt
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_survey_not_submitted" } };
    }
    case "days_in_phase": {
      const since = await lastPhaseChangeAt(orderId);
      if (!since) return { ok: false, reason: { key: "phase_reason_days_in_phase", params: { days: cond.days } } };
      const diffDays = (Date.now() - since.getTime()) / 86_400_000;
      return diffDays >= cond.days
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_days_in_phase", params: { days: cond.days } } };
    }
  }
}

export interface GateResult {
  ok: boolean;
  blockedReasons: EvaluatedReason[];
}

/** All conditions must be met (AND semantics). Empty list → ok. */
export async function evaluateOrderConditions(
  conditions: OrderCondition[],
  orderId: string
): Promise<GateResult> {
  if (conditions.length === 0) return { ok: true, blockedReasons: [] };
  const reasons: EvaluatedReason[] = [];
  for (const c of conditions) {
    const r = await evaluateOrderCondition(c, orderId);
    if (!r.ok && r.reason) reasons.push(r.reason);
  }
  return { ok: reasons.length === 0, blockedReasons: reasons };
}

/** Convenience: load target phase's enterGate and evaluate. */
export async function evaluateOrderEnterGate(
  orderId: string,
  targetPhaseId: string
): Promise<GateResult> {
  const phase = await prisma.orderPhase.findUnique({
    where: { id: targetPhaseId },
    select: { enterGate: true },
  });
  if (!phase) return { ok: true, blockedReasons: [] };
  const conditions = parseOrderConditions(phase.enterGate);
  return evaluateOrderConditions(conditions, orderId);
}

/** Convenience: check whether the order's CURRENT phase auto-advance triggers. */
export async function evaluateOrderAutoAdvance(
  orderId: string,
  currentPhaseId: string
): Promise<GateResult> {
  const phase = await prisma.orderPhase.findUnique({
    where: { id: currentPhaseId },
    select: { autoAdvance: true },
  });
  if (!phase) return { ok: false, blockedReasons: [] };
  const conditions = parseOrderConditions(phase.autoAdvance);
  if (conditions.length === 0) return { ok: false, blockedReasons: [] };
  return evaluateOrderConditions(conditions, orderId);
}

// ─────────────────────────────────────────────────────────────────
// Part-level evaluators (analogous, smaller catalog)
// ─────────────────────────────────────────────────────────────────

async function lastPartPhaseChangeAt(partId: string): Promise<Date | null> {
  // Parts don't have their own audit log; fall back to updatedAt on the row.
  const part = await prisma.orderPart.findUnique({
    where: { id: partId },
    select: { updatedAt: true },
  });
  return part?.updatedAt ?? null;
}

async function evaluatePartCondition(
  cond: PartCondition,
  partId: string
): Promise<{ ok: boolean; reason?: EvaluatedReason }> {
  switch (cond.type) {
    case "part_all_jobs_done": {
      const jobParts = await prisma.printJobPart.findMany({
        where: { orderPartId: partId },
        select: { printJob: { select: { status: true } } },
      });
      if (jobParts.length === 0)
        return { ok: false, reason: { key: "phase_reason_part_jobs_not_done" } };
      const ok = jobParts.every(
        (jp) => jp.printJob.status === "DONE" || jp.printJob.status === "CANCELLED"
      );
      return ok ? { ok: true } : { ok: false, reason: { key: "phase_reason_part_jobs_not_done" } };
    }
    case "part_assigned_to_job": {
      const c = await prisma.printJobPart.count({ where: { orderPartId: partId } });
      return c > 0
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_part_not_assigned_to_job" } };
    }
    case "part_days_in_phase": {
      const since = await lastPartPhaseChangeAt(partId);
      if (!since)
        return { ok: false, reason: { key: "phase_reason_part_days_in_phase", params: { days: cond.days } } };
      const diffDays = (Date.now() - since.getTime()) / 86_400_000;
      return diffDays >= cond.days
        ? { ok: true }
        : { ok: false, reason: { key: "phase_reason_part_days_in_phase", params: { days: cond.days } } };
    }
  }
}

export async function evaluatePartConditions(
  conditions: PartCondition[],
  partId: string
): Promise<GateResult> {
  if (conditions.length === 0) return { ok: true, blockedReasons: [] };
  const reasons: EvaluatedReason[] = [];
  for (const c of conditions) {
    const r = await evaluatePartCondition(c, partId);
    if (!r.ok && r.reason) reasons.push(r.reason);
  }
  return { ok: reasons.length === 0, blockedReasons: reasons };
}

export async function evaluatePartEnterGate(
  partId: string,
  targetPhaseId: string
): Promise<GateResult> {
  const phase = await prisma.partPhase.findUnique({
    where: { id: targetPhaseId },
    select: { enterGate: true },
  });
  if (!phase) return { ok: true, blockedReasons: [] };
  return evaluatePartConditions(parsePartConditions(phase.enterGate), partId);
}

export async function evaluatePartAutoAdvance(
  partId: string,
  currentPhaseId: string
): Promise<GateResult> {
  const phase = await prisma.partPhase.findUnique({
    where: { id: currentPhaseId },
    select: { autoAdvance: true },
  });
  if (!phase) return { ok: false, blockedReasons: [] };
  const conditions = parsePartConditions(phase.autoAdvance);
  if (conditions.length === 0) return { ok: false, blockedReasons: [] };
  return evaluatePartConditions(conditions, partId);
}

/** Pretty-print a condition's i18n-friendly label key (for audit log + UI). */
export function orderConditionLabelKey(c: OrderCondition): string {
  switch (c.type) {
    case "all_parts_in_phase_with_flag":
      if (c.flag === "isPrintReady") return "phase_condition_all_parts_print_ready";
      if (c.flag === "isPrinted") return "phase_condition_all_parts_printed";
      return "phase_condition_all_parts_misprint";
    case "all_jobs_done":
      return "phase_condition_all_jobs_done";
    case "quote_approved":
      return "phase_condition_quote_approved";
    case "invoice_paid":
      return "phase_condition_invoice_paid";
    case "verification_complete":
      return "phase_condition_verification_complete";
    case "survey_submitted":
      return "phase_condition_survey_submitted";
    case "days_in_phase":
      return "phase_condition_days_in_phase";
  }
}

export function partConditionLabelKey(c: PartCondition): string {
  switch (c.type) {
    case "part_all_jobs_done":
      return "phase_condition_part_all_jobs_done";
    case "part_assigned_to_job":
      return "phase_condition_part_assigned_to_job";
    case "part_days_in_phase":
      return "phase_condition_part_days_in_phase";
  }
}
