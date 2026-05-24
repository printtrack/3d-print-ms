import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { recalcQuoteTotalsTx, syncOrderPriceEstimateTx } from "@/lib/quotes";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int(),
  taxRatePercent: z.number().min(0).max(100).default(19),
  category: z.enum([
    "FILAMENT",
    "HARDWARE",
    "POST_PROCESSING",
    "DESIGN",
    "SHIPPING",
    "DISCOUNT",
    "OTHER",
  ]),
  source: z.enum(["ESTIMATE", "FIXED", "ACTUAL"]).default("FIXED"),
  orderPartId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  items: z.array(itemSchema).optional(),
  notes: z.string().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (quote.status !== "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Gesendete Angebote können nicht bearbeitet werden. Bitte neue Version erstellen.",
        },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        if (data.items.length > 0) {
          await tx.quoteItem.createMany({
            data: data.items.map((it, idx) => ({
              quoteId: id,
              position: idx,
              description: it.description,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              taxRatePercent: it.taxRatePercent,
              category: it.category,
              source: it.source,
              orderPartId: it.orderPartId ?? null,
            })),
          });
        }
      }

      await tx.quote.update({
        where: { id },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.validUntil !== undefined
            ? { validUntil: data.validUntil ? new Date(data.validUntil) : null }
            : {}),
        },
      });

      await recalcQuoteTotalsTx(tx, id);
      await syncOrderPriceEstimateTx(tx, quote.orderId);

      await tx.auditLog.create({
        data: {
          orderId: quote.orderId,
          userId: userId ?? null,
          action: "QUOTE_UPDATED",
          details: `Angebot v${quote.version} bearbeitet`,
        },
      });

      return tx.quote.findUnique({
        where: { id },
        include: { items: { orderBy: { position: "asc" } } },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Quote update error:", err);
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
  const userId = session.user?.id;

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quote.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Nur Entwürfe können gelöscht werden." },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.delete({ where: { id } });
    await syncOrderPriceEstimateTx(tx, quote.orderId);
    await tx.auditLog.create({
      data: {
        orderId: quote.orderId,
        userId: userId ?? null,
        action: "QUOTE_DELETED",
        details: `Angebot v${quote.version} gelöscht`,
      },
    });
  });

  return NextResponse.json({ success: true });
}
