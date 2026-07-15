import { NextRequest, NextResponse } from "next/server";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { orderIdOfInvoice } from "@/lib/authz-resolve";
import { z } from "zod";
import { recordPayment, syncOrderPhaseFromInvoiceStatus } from "@/lib/invoices";
import { triggerOrderAutoAdvance } from "@/lib/phase-auto-advance";

const postSchema = z.object({
  amountCents: z.number().int(),
  paidAt: z.string().datetime(),
  method: z.enum(["SEPA", "CASH", "PAYPAL", "CREDIT", "CARD", "OTHER"]),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scopeId = await orderIdOfInvoice(id);
  if (!scopeId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderAccess(scopeId, "billing.payments.record");
  if (guard) return guard;
  const userId = (await getActor())?.id ?? null;

  try {
    const body = await req.json();
    const data = postSchema.parse(body);
    const result = await recordPayment(
      id,
      {
        amountCents: data.amountCents,
        paidAt: new Date(data.paidAt),
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      },
      userId
    );

    // Sync order phase outside the payment transaction so failures here
    // don't roll back the payment itself.
    if (result.newStatus !== result.previousStatus) {
      await syncOrderPhaseFromInvoiceStatus(result.orderId, result.newStatus, userId);
    }

    triggerOrderAutoAdvance(result.orderId);

    return NextResponse.json(result.payment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Payment record error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
