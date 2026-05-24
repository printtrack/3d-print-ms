import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  computeTotals,
  getNextVersion,
  recalcQuoteTotalsTx,
  syncOrderPriceEstimateTx,
  buildItemsFromParts,
} from "@/lib/quotes";

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

const postSchema = z.object({
  items: z.array(itemSchema).default([]),
  notes: z.string().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  cloneFromQuoteId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quotes = await prisma.quote.findMany({
    where: { orderId: id },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { version: "desc" },
  });
  return NextResponse.json(quotes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;
  const userId = session.user?.id;

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Block: at most one open (DRAFT/SENT) quote at a time
    const open = await prisma.quote.findFirst({
      where: { orderId, status: { in: ["DRAFT", "SENT"] } },
      select: { id: true, status: true, version: true },
    });
    if (open && !data.cloneFromQuoteId) {
      return NextResponse.json(
        {
          error: `Es gibt bereits ein offenes Angebot (Version ${open.version}, ${open.status}). Bitte erst abschließen oder bearbeiten.`,
        },
        { status: 409 }
      );
    }

    let itemsToCreate = data.items;

    // Auto-prefill from existing parts when no items + no clone specified.
    // This is the common "create quote" flow — admin creates parts first,
    // then clicks "Angebot erstellen" and gets a draft pre-populated with
    // ESTIMATE items linked to those parts (so actual costs flow through on issue).
    if (itemsToCreate.length === 0 && !data.cloneFromQuoteId) {
      itemsToCreate = await buildItemsFromParts(orderId);
    }

    if (data.cloneFromQuoteId) {
      const source = await prisma.quote.findFirst({
        where: { id: data.cloneFromQuoteId, orderId },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (!source) {
        return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
      }
      itemsToCreate = source.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPriceCents: it.unitPriceCents,
        taxRatePercent: Number(it.taxRatePercent),
        category: it.category,
        source: it.source,
        orderPartId: it.orderPartId,
      }));
    }

    const totals = computeTotals(itemsToCreate);
    const version = await getNextVersion(orderId);

    const created = await prisma.$transaction(async (tx) => {
      // Supersede previous SENT/DRAFT quotes when cloning forward
      if (data.cloneFromQuoteId) {
        await tx.quote.updateMany({
          where: { orderId, status: { in: ["DRAFT", "SENT"] } },
          data: { status: "SUPERSEDED" },
        });
      }
      const quote = await tx.quote.create({
        data: {
          orderId,
          version,
          status: "DRAFT",
          notes: data.notes,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          createdById: userId ?? null,
          totalCents: totals.totalCents,
          taxCents: totals.taxCents,
          items: {
            create: itemsToCreate.map((it, idx) => ({
              position: idx,
              description: it.description,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              taxRatePercent: it.taxRatePercent,
              category: it.category,
              source: it.source,
              orderPartId: it.orderPartId ?? null,
            })),
          },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      await recalcQuoteTotalsTx(tx, quote.id);
      await syncOrderPriceEstimateTx(tx, orderId);
      await tx.auditLog.create({
        data: {
          orderId,
          userId: userId ?? null,
          action: "QUOTE_CREATED",
          details: `Angebot v${version} erstellt`,
        },
      });
      return quote;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Quote create error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
