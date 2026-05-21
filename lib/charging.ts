import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export interface IterationInput {
  orderPartId: string;
  pieceIndex: number;
  result: "success" | "misprint";
  gramsActual: number;
}

export type ChargeReason =
  | "charged"
  | "no_price"
  | "misprint_skipped"
  | "prototype_skipped";

export interface ChargingDecision extends IterationInput {
  costCents: number | null;
  reason: ChargeReason;
}

export async function computeCharges(
  iterations: IterationInput[]
): Promise<ChargingDecision[]> {
  if (iterations.length === 0) return [];

  const partIds = [...new Set(iterations.map((i) => i.orderPartId))];

  const parts = await prisma.orderPart.findMany({
    where: { id: { in: partIds } },
    select: {
      id: true,
      filament: { select: { pricePerKg: true } },
      order: { select: { isPrototype: true } },
    },
  });

  const partMap = new Map(parts.map((p) => [p.id, p]));

  const [chargeMisprints, chargePrototypes] = await Promise.all([
    getSetting("charge_misprints"),
    getSetting("charge_prototypes"),
  ]);

  return iterations.map((iter) => {
    const part = partMap.get(iter.orderPartId);

    if (!part?.filament?.pricePerKg) {
      return { ...iter, costCents: null, reason: "no_price" };
    }

    if (iter.result === "misprint" && chargeMisprints !== "true") {
      return { ...iter, costCents: null, reason: "misprint_skipped" };
    }

    if (part.order.isPrototype && chargePrototypes !== "true") {
      return { ...iter, costCents: null, reason: "prototype_skipped" };
    }

    const costCents = Math.round(
      (iter.gramsActual / 1000) * Number(part.filament.pricePerKg) * 100
    );
    return { ...iter, costCents, reason: "charged" };
  });
}
