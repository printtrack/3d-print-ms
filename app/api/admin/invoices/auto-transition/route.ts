import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runInvoiceAutoTransition, runPaymentReminders } from "@/lib/invoice-auto-transition";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transitions = await runInvoiceAutoTransition();
  const reminders = await runPaymentReminders();
  return NextResponse.json({ ...transitions, reminders });
}
