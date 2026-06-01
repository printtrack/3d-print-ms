import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Phase auto-advance", () => {
  test("order auto-advances after invoice is fully paid", async ({ seed, page }) => {
    // Configure "Rechnung offen" (position 4) with autoAdvance: invoice_paid
    const rechnungOffen = seed.phases.find((p) => p.position === 4)!;
    const abgeschlossen = seed.phases.find((p) => p.position === 5)!;
    await prismaTest.orderPhase.update({
      where: { id: rechnungOffen.id },
      data: { autoAdvance: [{ type: "invoice_paid" }] },
    });

    const order = await createTestOrder(rechnungOffen.id, { customerName: "AutoPay" });

    // Create a paid invoice for the order
    const invoice = await prismaTest.invoice.create({
      data: {
        orderId: order.id,
        status: "PAID",
        totalCents: 5000,
        taxCents: 798,
        number: "2026-0001",
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });
    await prismaTest.payment.create({
      data: {
        invoiceId: invoice.id,
        amountCents: 5000,
        paidAt: new Date(),
        method: "SEPA",
      },
    });

    // Trigger via the auto-advance API endpoint
    const res = await page.request.post("/api/admin/orders/auto-advance", {
      data: { orderId: order.id },
    });
    expect(res.ok()).toBe(true);
    const result = await res.json();
    expect(result.advanced).toBe(true);

    const updated = await prismaTest.order.findUnique({ where: { id: order.id } });
    expect(updated?.phaseId).toBe(abgeschlossen.id);

    const audit = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "PHASE_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.details).toContain("auto-advance");
    void page; // unused
  });

  test("auto-advance does not fire when no condition is met", async ({ seed, page }) => {
    const eingegangen = seed.phases.find((p) => p.position === 0)!;
    // survey_submitted is unset on a fresh order → auto-advance must not fire.
    await prismaTest.orderPhase.update({
      where: { id: eingegangen.id },
      data: { autoAdvance: [{ type: "survey_submitted" }] },
    });

    const order = await createTestOrder(eingegangen.id);
    const res = await page.request.post("/api/admin/orders/auto-advance", {
      data: { orderId: order.id },
    });
    expect(res.ok()).toBe(true);
    const result = await res.json();
    expect(result.advanced).toBe(false);

    const stayed = await prismaTest.order.findUnique({ where: { id: order.id } });
    expect(stayed?.phaseId).toBe(eingegangen.id);
  });
});
