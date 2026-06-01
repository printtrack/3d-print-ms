import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Phase gates (enterGate)", () => {
  test("manual phase move is blocked when enterGate is not met, then overridable with reason", async ({
    seed,
    page,
  }) => {
    // Configure "In Bearbeitung" (position 2) with enterGate: all_parts_in_phase_with_flag=isPrintReady
    const inBearbeitung = seed.phases.find((p) => p.position === 2)!;
    const eingegangen = seed.phases.find((p) => p.position === 0)!;
    await prismaTest.orderPhase.update({
      where: { id: inBearbeitung.id },
      data: {
        enterGate: [{ type: "all_parts_in_phase_with_flag", flag: "isPrintReady" }],
      },
    });

    const order = await createTestOrder(eingegangen.id, { customerName: "Gate Test" });
    // Part is in the design phase (not isPrintReady) — gate should fail
    const designPhase = seed.partPhases.find((p) => p.isDefault)!;
    await createTestOrderPart(order.id, { partPhaseId: designPhase.id });

    // Try to PATCH the order's phase without overrideReason — expect 422
    const blocked = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: inBearbeitung.id },
    });
    expect(blocked.status()).toBe(422);
    const blockedBody = await blocked.json();
    expect(blockedBody.code).toBe("PHASE_GATE");
    expect(blockedBody.reasonKeys).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "phase_reason_parts_not_print_ready" })])
    );

    // Retry with overrideReason — should succeed
    const overridden = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: inBearbeitung.id, overrideReason: "Manuell freigegeben nach Absprache" },
    });
    expect(overridden.ok()).toBe(true);

    // Verify the order moved AND an audit log records the override
    const updated = await prismaTest.order.findUnique({ where: { id: order.id } });
    expect(updated?.phaseId).toBe(inBearbeitung.id);
    const overrideLog = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "GATE_OVERRIDDEN" },
    });
    expect(overrideLog).not.toBeNull();
    expect(overrideLog?.details).toContain("Manuell freigegeben");
  });

  test("gate passes when all conditions met — straight-through move", async ({ seed, page }) => {
    const inBearbeitung = seed.phases.find((p) => p.position === 2)!;
    const eingegangen = seed.phases.find((p) => p.position === 0)!;
    await prismaTest.orderPhase.update({
      where: { id: inBearbeitung.id },
      data: { enterGate: [{ type: "all_parts_in_phase_with_flag", flag: "isPrintReady" }] },
    });

    const order = await createTestOrder(eingegangen.id);
    const printReady = seed.partPhases.find((p) => p.isPrintReady)!;
    await createTestOrderPart(order.id, { partPhaseId: printReady.id });

    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: inBearbeitung.id },
    });
    expect(res.ok()).toBe(true);
  });

  test("blocked card shows lock badge on Kanban", async ({ seed, page }) => {
    const inBearbeitung = seed.phases.find((p) => p.position === 2)!;
    const eingegangen = seed.phases.find((p) => p.position === 0)!;
    // Put gate on the NEXT phase (In Prüfung — position 1)
    const inPruefung = seed.phases.find((p) => p.position === 1)!;
    await prismaTest.orderPhase.update({
      where: { id: inPruefung.id },
      data: { enterGate: [{ type: "all_jobs_done" }] },
    });

    const order = await createTestOrder(eingegangen.id, { customerName: "Locked Order" });
    void inBearbeitung;

    await page.goto("/admin/orders");
    await expect(page.locator('[data-testid="kanban-board"]')).toBeVisible();
    // The card in "Eingegangen" should display the blocked-next lock badge
    // since the next phase (In Prüfung) has a gate that isn't met.
    const card = page.getByText("Locked Order").first();
    await expect(card).toBeVisible();
    await expect(page.locator('[data-testid="order-card-blocked-next"]').first()).toBeVisible();
    void order;
  });
});
