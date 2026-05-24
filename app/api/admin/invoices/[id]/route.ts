import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  notes: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      reminders: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data = patchSchema.parse(body);

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only DRAFT can be freely edited; ISSUED only allows note + dueAt change
  if (invoice.status === "CANCELLED") {
    return NextResponse.json({ error: "Stornierte Rechnungen sind nicht editierbar." }, { status: 409 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Nur Entwürfe können gelöscht werden. Ausgestellte Rechnungen müssen storniert werden." },
      { status: 409 }
    );
  }

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
