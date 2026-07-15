import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { orderIdOfQuote } from "@/lib/authz-resolve";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { syncQuoteWithPartsTx, syncOrderPriceEstimateTx } from "@/lib/quotes";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scopeId = await orderIdOfQuote(id);
  if (!scopeId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderAccess(scopeId, "billing.quotes.manage");
  if (guard) return guard;
  const userId = (await getActor())?.id ?? null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id }, select: { orderId: true, version: true } });
      if (!quote) throw new Error("Quote not found");
      const added = await syncQuoteWithPartsTx(tx, id);
      await syncOrderPriceEstimateTx(tx, quote.orderId);
      if (added > 0) {
        await tx.auditLog.create({
          data: {
            orderId: quote.orderId,
            userId,
            action: "QUOTE_UPDATED",
            details: `Angebot v${quote.version} aus Teilen ergänzt (+${added} Posten)`,
          },
        });
      }
      return { added };
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Quote sync error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
