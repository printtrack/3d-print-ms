import { NextRequest, NextResponse } from "next/server";
import { assertOrderAccess, getActor } from "@/lib/authz";
import { orderIdOfInvoice } from "@/lib/authz-resolve";
import { cancelInvoice } from "@/lib/invoices";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scopeId = await orderIdOfInvoice(id);
  if (!scopeId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await assertOrderAccess(scopeId, "billing.invoices.manage");
  if (guard) return guard;
  const userId = (await getActor())?.id ?? null;

  try {
    const result = await cancelInvoice(id, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Invoice cancel error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
