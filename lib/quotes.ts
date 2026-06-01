import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export type QuoteItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  category:
    | "FILAMENT"
    | "HARDWARE"
    | "POST_PROCESSING"
    | "DESIGN"
    | "SHIPPING"
    | "DISCOUNT"
    | "OTHER";
  source: "ESTIMATE" | "FIXED" | "ACTUAL";
  orderPartId?: string | null;
};

export function computeTotals(items: QuoteItemInput[]): {
  totalCents: number;
  taxCents: number;
} {
  let net = 0;
  let tax = 0;
  for (const item of items) {
    const line = Math.round(item.quantity * item.unitPriceCents);
    net += line;
    tax += Math.round((line * item.taxRatePercent) / 100);
  }
  return { totalCents: net + tax, taxCents: tax };
}

export async function getActiveQuote(orderId: string) {
  return prisma.quote.findFirst({
    where: {
      orderId,
      status: { in: ["DRAFT", "SENT", "APPROVED"] },
    },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { version: "desc" },
  });
}

export async function getNextVersion(orderId: string): Promise<number> {
  const last = await prisma.quote.findFirst({
    where: { orderId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (last?.version ?? 0) + 1;
}

export async function shouldGateOnQuote(orderId: string): Promise<{
  gate: boolean;
  reason?: string;
}> {
  const settings = await getSettings();
  if (settings.require_quote_approval !== "true") {
    return { gate: false };
  }

  const minCents = parseInt(settings.quote_approval_min_cents ?? "0", 10) || 0;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { isPrototype: true },
  });

  if (!order || order.isPrototype) {
    return { gate: false };
  }

  const approved = await prisma.quote.findFirst({
    where: { orderId, status: "APPROVED" },
    orderBy: { version: "desc" },
    select: { id: true, totalCents: true },
  });
  if (approved) {
    return { gate: false };
  }

  const draftOrSent = await prisma.quote.findFirst({
    where: { orderId, status: { in: ["DRAFT", "SENT"] } },
    orderBy: { version: "desc" },
    select: { totalCents: true },
  });

  // If no quote was ever started for this order, don't block — the workflow
  // can simply skip the quote step for low-touch orders. The gate only kicks
  // in once an admin has begun a quote (DRAFT/SENT) but it isn't yet APPROVED.
  if (!draftOrSent) {
    return { gate: false };
  }

  if (draftOrSent.totalCents < minCents) {
    return { gate: false };
  }

  return {
    gate: true,
    reason:
      "Kunde hat das Angebot noch nicht bestätigt. Bitte Angebot senden oder Override verwenden.",
  };
}

export async function recalcQuoteTotalsTx(
  tx: Prisma.TransactionClient,
  quoteId: string
) {
  const items = await tx.quoteItem.findMany({ where: { quoteId } });
  let net = 0;
  let tax = 0;
  for (const item of items) {
    const qty = Number(item.quantity);
    const line = Math.round(qty * item.unitPriceCents);
    net += line;
    tax += Math.round((line * Number(item.taxRatePercent)) / 100);
  }
  await tx.quote.update({
    where: { id: quoteId },
    data: { totalCents: net + tax, taxCents: tax },
  });
  return { totalCents: net + tax, taxCents: tax };
}

/**
 * Build ESTIMATE quote items from existing OrderParts.
 *
 * One item per non-misprint part. Pricing uses `gramsEstimated × pricePerKg / 1000 × quantity`.
 * If `gramsEstimated` or `Filament.pricePerKg` is missing, the item is created with
 * `unitPriceCents: 0` so the admin can fill it in manually (UI flags this as incomplete).
 *
 * Items get `source: "ESTIMATE"` and `orderPartId` set, so when the invoice is issued
 * the actual costs from `OrderPartIteration.chargedCents` replace the estimate.
 */
export async function buildItemsFromParts(
  orderId: string,
  excludePartIds: Set<string> = new Set()
): Promise<QuoteItemInput[]> {
  const parts = await prisma.orderPart.findMany({
    where: {
      orderId,
      id: excludePartIds.size > 0 ? { notIn: [...excludePartIds] } : undefined,
      // Exclude misprint phase parts — those aren't real deliverables
      OR: [
        { partPhase: null },
        { partPhase: { isMisprint: false } },
      ],
    },
    include: { filament: { select: { name: true, material: true, color: true, pricePerKg: true } } },
    orderBy: { createdAt: "asc" },
  });

  return parts.map((part) => {
    const grams = part.gramsEstimated ?? 0;
    const pricePerKg = part.filament?.pricePerKg ? Number(part.filament.pricePerKg) : 0;
    // pricePerKg is in EUR/kg, gramsEstimated in g → cents = round(grams * pricePerKg / 10)
    const unitPriceCents = grams > 0 && pricePerKg > 0 ? Math.round((grams * pricePerKg) / 10) : 0;

    const materialNote = part.filament
      ? ` (${part.filament.material}${part.filament.color ? ", " + part.filament.color : ""}${grams > 0 ? `, ${grams} g` : ""})`
      : "";

    return {
      description: `${part.name}${materialNote}`,
      quantity: part.quantity,
      unitPriceCents,
      taxRatePercent: 19,
      category: "FILAMENT" as const,
      source: "ESTIMATE" as const,
      orderPartId: part.id,
    };
  });
}

/**
 * Add parts that aren't yet represented in the given quote (matched by orderPartId).
 * Returns the count of items added. Quote must be DRAFT.
 */
export async function syncQuoteWithPartsTx(
  tx: Prisma.TransactionClient,
  quoteId: string
): Promise<number> {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: { items: { select: { orderPartId: true } } },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") throw new Error("Only DRAFT quotes can be synced");

  const existingPartIds = new Set(
    quote.items.map((i) => i.orderPartId).filter((id): id is string => Boolean(id))
  );

  // Reuse buildItemsFromParts logic — passing prisma is ugly because it's not tx-scoped,
  // but the parts read is independent of the quote write, so it's safe here.
  const newItems = await buildItemsFromParts(quote.orderId, existingPartIds);
  if (newItems.length === 0) return 0;

  const startPosition = quote.items.length;
  await tx.quoteItem.createMany({
    data: newItems.map((it, idx) => ({
      quoteId,
      position: startPosition + idx,
      description: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      taxRatePercent: it.taxRatePercent,
      category: it.category,
      source: it.source,
      orderPartId: it.orderPartId ?? null,
    })),
  });
  await recalcQuoteTotalsTx(tx, quoteId);
  return newItems.length;
}

export async function syncOrderPriceEstimateTx(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const active = await tx.quote.findFirst({
    where: { orderId, status: { in: ["DRAFT", "SENT", "APPROVED"] } },
    orderBy: { version: "desc" },
    select: { totalCents: true },
  });
  await tx.order.update({
    where: { id: orderId },
    data: {
      priceEstimate: active ? new Prisma.Decimal(active.totalCents / 100) : null,
    },
  });
}
