import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDraftInvoiceFromQuote } from "@/lib/invoices";
import { assertFeature } from "@/lib/features";
import { z } from "zod";

const postSchema = z.object({
  quoteId: z.string(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoices = await prisma.invoice.findMany({
    where: { orderId: id },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await assertFeature("invoices");
  if (guard) return guard;

  const { id: orderId } = await params;
  const userId = session.user?.id;

  try {
    const body = await req.json();
    const { quoteId } = postSchema.parse(body);

    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.orderId !== orderId) {
      return NextResponse.json({ error: "Quote not found for this order" }, { status: 404 });
    }
    if (quote.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Nur angenommene Angebote können in Rechnungen umgewandelt werden." },
        { status: 409 }
      );
    }

    // Block if there's already an open invoice for this quote
    const existing = await prisma.invoice.findFirst({
      where: { quoteId, status: { in: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Es existiert bereits eine offene Rechnung für dieses Angebot." },
        { status: 409 }
      );
    }

    const invoice = await createDraftInvoiceFromQuote(quoteId, userId ?? null);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Invoice create error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
