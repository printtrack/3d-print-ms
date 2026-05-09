import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { publish } from "@/lib/event-bus";

const verifySchema = z.object({
  parts: z.array(
    z.object({
      orderPartId: z.string().min(1),
      result: z.enum(["success", "misprint"]),
    })
  ).min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const body = await req.json();
    const { parts } = verifySchema.parse(body);

    const job = await prisma.printJob.findUnique({
      where: { id },
      include: {
        parts: { include: { orderPart: { include: { order: { select: { id: true } } } } } },
        machine: { select: { name: true } },
      },
    });

    if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (job.status !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ error: "Job ist nicht zur Verifikation ausstehend" }, { status: 400 });
    }

    // All parts of the job must be covered by the request
    const jobPartIds = new Set(job.parts.map((p) => p.orderPartId));
    const submittedIds = new Set(parts.map((p) => p.orderPartId));
    for (const id of jobPartIds) {
      if (!submittedIds.has(id)) {
        return NextResponse.json(
          { error: `Teil ${id} fehlt in der Verifikation` },
          { status: 400 }
        );
      }
    }

    // Fetch the target phases once
    const [printedPhase, misprintPhase] = await Promise.all([
      prisma.partPhase.findFirst({ where: { isPrinted: true } }),
      prisma.partPhase.findFirst({ where: { isMisprint: true } }),
    ]);

    if (!printedPhase || !misprintPhase) {
      return NextResponse.json(
        { error: "Phasen für Gedruckt/Fehldruck nicht konfiguriert" },
        { status: 500 }
      );
    }

    // Group parts by their order for audit logging
    const partToOrder = new Map<string, string>();
    for (const jp of job.parts) {
      partToOrder.set(jp.orderPartId, jp.orderPart.order.id);
    }

    // Apply verification results
    for (const { orderPartId, result } of parts) {
      const targetPhaseId = result === "success" ? printedPhase.id : misprintPhase.id;
      const targetPhaseName = result === "success" ? printedPhase.name : misprintPhase.name;
      const orderId = partToOrder.get(orderPartId);
      if (!orderId) continue;

      await prisma.orderPart.update({
        where: { id: orderPartId },
        data: { partPhaseId: targetPhaseId },
      });

      await prisma.auditLog.create({
        data: {
          orderId,
          userId,
          action: "PART_VERIFIED",
          details: `Teil auf Phase "${targetPhaseName}" gesetzt nach Verifikation von Job ${id} (${result === "success" ? "Erfolgreich" : "Fehldruck"})`,
        },
      });
    }

    // Transition job to DONE
    await prisma.printJob.update({
      where: { id },
      data: { status: "DONE" },
    });

    // Audit log for job completion
    const orderIds = [...new Set([...partToOrder.values()])];
    if (orderIds.length > 0) {
      await prisma.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          orderId,
          userId,
          action: "JOB_COMPLETED",
          details: `Job ${id} auf ${job.machine.name} nach Verifikation abgeschlossen`,
        })),
      });
    }

    publish({ type: "job.changed", jobId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
