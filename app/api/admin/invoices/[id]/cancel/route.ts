import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cancelInvoice } from "@/lib/invoices";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user?.id ?? null;

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
