import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id ?? null;

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
