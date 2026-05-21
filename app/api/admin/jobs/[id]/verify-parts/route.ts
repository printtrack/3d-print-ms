import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { publish } from "@/lib/event-bus";
import { computeCharges } from "@/lib/charging";

const verifySchema = z.object({
  iterations: z.array(
    z.object({
      orderPartId: z.string().min(1),
      pieceIndex: z.number().int().min(0),
      result: z.enum(["success", "misprint"]),
      gramsActual: z.number().int().min(0),
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
    const { iterations } = verifySchema.parse(body);

    const job = await prisma.printJob.findUnique({
      where: { id },
      include: {
        parts: {
          include: {
            orderPart: {
              select: {
                id: true,
                quantity: true,
                filamentId: true,
                order: { select: { id: true, customerEmail: true } },
              },
            },
          },
        },
        machine: { select: { name: true } },
      },
    });

    if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (job.status !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ error: "Job ist nicht zur Verifikation ausstehend" }, { status: 400 });
    }

    // Validate: every part needs exactly `quantity` iterations with correct indices
    const jobPartMap = new Map(job.parts.map((p) => [p.orderPartId, p.orderPart]));
    for (const [partId, orderPart] of jobPartMap) {
      const partIters = iterations.filter((i) => i.orderPartId === partId);
      if (partIters.length !== orderPart.quantity) {
        return NextResponse.json(
          { error: `Teil ${partId} erwartet ${orderPart.quantity} Iterationen, erhalten: ${partIters.length}` },
          { status: 400 }
        );
      }
      const indices = new Set(partIters.map((i) => i.pieceIndex));
      for (let k = 0; k < orderPart.quantity; k++) {
        if (!indices.has(k)) {
          return NextResponse.json(
            { error: `Teil ${partId}: Iteration ${k} fehlt` },
            { status: 400 }
          );
        }
      }
    }

    // Fetch target phases once
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

    // Compute charging decisions
    const charges = await computeCharges(iterations);

    // Group: filament inventory deductions (gramsActual per filamentId)
    const filamentDeductions = new Map<string, number>();
    for (const iter of iterations) {
      const part = jobPartMap.get(iter.orderPartId);
      if (part?.filamentId) {
        filamentDeductions.set(
          part.filamentId,
          (filamentDeductions.get(part.filamentId) ?? 0) + iter.gramsActual
        );
      }
    }

    // Group: customer charges per customerId (via customerEmail → Customer)
    const chargeByPart = new Map<string, { costCents: number; orderId: string }>();
    for (const ch of charges) {
      if (ch.costCents != null && ch.costCents > 0) {
        const part = jobPartMap.get(ch.orderPartId);
        if (!part) continue;
        const existing = chargeByPart.get(ch.orderPartId);
        chargeByPart.set(ch.orderPartId, {
          costCents: (existing?.costCents ?? 0) + ch.costCents,
          orderId: part.order.id,
        });
      }
    }

    // Resolve customers by email
    const orderEmails = [...new Set(job.parts.map((p) => p.orderPart.order.customerEmail))];
    const customers = await prisma.customer.findMany({
      where: { email: { in: orderEmails } },
      select: { id: true, email: true },
    });
    const emailToCustomer = new Map(customers.map((c) => [c.email, c]));

    // Aggregate charges per customer
    const customerCharges = new Map<string, { customerId: string; totalCents: number; orderIds: Set<string> }>();
    for (const [partId, charge] of chargeByPart) {
      const part = jobPartMap.get(partId);
      if (!part) continue;
      const customer = emailToCustomer.get(part.order.customerEmail);
      if (!customer) continue;
      const existing = customerCharges.get(customer.id);
      if (existing) {
        existing.totalCents += charge.costCents;
        existing.orderIds.add(charge.orderId);
      } else {
        customerCharges.set(customer.id, {
          customerId: customer.id,
          totalCents: charge.costCents,
          orderIds: new Set([charge.orderId]),
        });
      }
    }

    // Aggregate for audit summary
    const successCount = iterations.filter((i) => i.result === "success").length;
    const misprintCount = iterations.filter((i) => i.result === "misprint").length;
    const totalGrams = iterations.reduce((s, i) => s + i.gramsActual, 0);
    const totalCharged = charges.reduce((s, c) => s + (c.costCents ?? 0), 0);

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create OrderPartIterations
      for (const ch of charges) {
        await tx.orderPartIteration.create({
          data: {
            orderPartId: ch.orderPartId,
            pieceIndex: ch.pieceIndex,
            result: ch.result,
            gramsActual: ch.gramsActual,
            chargedCents: ch.costCents,
            chargeReason: ch.reason,
            printJobId: id,
            verifiedBy: userId,
          },
        });
      }

      // 2. Update OrderPart phases and aggregate cache
      for (const [partId, orderPart] of jobPartMap) {
        const partIters = iterations.filter((i) => i.orderPartId === partId);
        const allSuccess = partIters.every((i) => i.result === "success");
        const targetPhaseId = allSuccess ? printedPhase.id : misprintPhase.id;
        const gramsActualTotal = partIters.reduce((s, i) => s + i.gramsActual, 0);
        const chargedCentsTotal = charges
          .filter((c) => c.orderPartId === partId)
          .reduce((s, c) => s + (c.costCents ?? 0), 0);

        await tx.orderPart.update({
          where: { id: partId },
          data: {
            partPhaseId: targetPhaseId,
            gramsActualTotal,
            chargedCentsTotal: chargedCentsTotal > 0 ? chargedCentsTotal : null,
          },
        });

        // Audit log per order
        const phaseName = allSuccess ? printedPhase.name : misprintPhase.name;
        await tx.auditLog.create({
          data: {
            orderId: orderPart.order.id,
            userId,
            action: "PART_VERIFIED",
            details: `${partIters.length} Stück: ${partIters.filter(i => i.result === "success").length} erfolgreich, ${partIters.filter(i => i.result === "misprint").length} Fehldrucke. Gewicht: ${gramsActualTotal} g. Phase: "${phaseName}"`,
          },
        });
      }

      // 3. Deduct from filament inventory
      for (const [filamentId, grams] of filamentDeductions) {
        await tx.filament.update({
          where: { id: filamentId },
          data: { remainingGrams: { decrement: grams } },
        });
      }

      // 4. Deduct from customer balances
      for (const { customerId, totalCents, orderIds } of customerCharges.values()) {
        await tx.customer.update({
          where: { id: customerId },
          data: { creditBalanceCents: { decrement: totalCents } },
        });
        for (const orderId of orderIds) {
          await tx.customerCredit.create({
            data: {
              customerId,
              amountCents: -totalCents,
              reason: `Abzug für Job ${job.shortCode ?? id}: ${successCount} Stück gedruckt`,
              orderId,
              performedBy: userId,
            },
          });
        }
      }

      // 5. Transition job to DONE
      await tx.printJob.update({
        where: { id },
        data: { status: "DONE" },
      });

      // 6. JOB_COMPLETED audit logs
      const orderIds = [...new Set(job.parts.map((p) => p.orderPart.order.id))];
      await tx.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          orderId,
          userId,
          action: "JOB_COMPLETED",
          details: `Job ${id} auf ${job.machine.name} abgeschlossen — ${successCount} OK, ${misprintCount} Fehldrucke, ${totalGrams} g, berechnet ${(totalCharged / 100).toFixed(2)} €`,
        })),
      });
    });

    publish({ type: "job.changed", jobId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    console.error("verify-parts error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
