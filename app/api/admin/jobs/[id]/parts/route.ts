import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  orderPartId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: printJobId } = await params;

  try {
    const body = await req.json();
    const { orderPartId } = createSchema.parse(body);

    const part = await prisma.orderPart.findUnique({ where: { id: orderPartId } });
    if (!part) return NextResponse.json({ error: "Teil nicht gefunden" }, { status: 404 });

    // A part can only be assigned to one active job at a time
    const existingActiveLink = await prisma.printJobPart.findFirst({
      where: {
        orderPartId,
        printJob: { status: { notIn: ["DONE", "CANCELLED"] } },
        NOT: { printJobId },
      },
      include: { printJob: { select: { machine: { select: { name: true } } } } },
    });
    if (existingActiveLink) {
      return NextResponse.json(
        { error: `Teil ist bereits einem aktiven Job zugewiesen (${existingActiveLink.printJob.machine.name})` },
        { status: 409 }
      );
    }

    await prisma.printJobPart.upsert({
      where: { printJobId_orderPartId: { printJobId, orderPartId } },
      create: { printJobId, orderPartId },
      update: {},
    });

    await prisma.auditLog.create({
      data: {
        orderId: part.orderId,
        userId: (session.user as { id?: string })?.id ?? null,
        action: "JOB_ASSIGNED",
        details: `Teil "${part.name}" zum Druckjob ${printJobId} hinzugefügt`,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
