import { test, expect, loginAs } from "../fixtures/test-base";
import {
  createTestOrder,
  createTestUser,
  createTestTeamRole,
  prismaTest,
} from "../fixtures/db";

function rejectedPhase(seed: { phases: Array<{ id: string; name: string }> }) {
  const p = seed.phases.find((x) => x.name === "Abgelehnt");
  if (!p) throw new Error("Abgelehnt phase not seeded");
  return p;
}
function onHoldPhase(seed: { phases: Array<{ id: string; name: string }> }) {
  const p = seed.phases.find((x) => x.name === "Zurückgestellt");
  if (!p) throw new Error("Zurückgestellt phase not seeded");
  return p;
}

test.describe("Reject an order", () => {
  test("happy path: rejects, archives and records reason + audit log", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, { customerName: "Ablehn Kunde" });

    const res = await page.request.post(`/api/admin/orders/${order.id}/reject`, {
      data: { reason: "Technisch nicht umsetzbar" },
    });
    expect(res.status()).toBe(200);

    const updated = await prismaTest.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { phase: true },
    });
    expect(updated.phaseId).toBe(rejectedPhase(seed).id);
    expect(updated.phase.isRejected).toBe(true);
    expect(updated.rejectionReason).toBe("Technisch nicht umsetzbar");
    expect(updated.rejectedAt).not.toBeNull();
    expect(updated.archivedAt).not.toBeNull();

    const audit = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "ORDER_REJECTED" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.details).toContain("Technisch nicht umsetzbar");
  });

  test("error case: an empty reason is rejected with 400", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id);
    const res = await page.request.post(`/api/admin/orders/${order.id}/reject`, {
      data: { reason: "" },
    });
    expect(res.status()).toBe(400);

    const unchanged = await prismaTest.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.phaseId).toBe(seed.phases[0].id);
    expect(unchanged.rejectedAt).toBeNull();
  });

  test("already-rejected order cannot be rejected again", async ({ seed, page }) => {
    const order = await createTestOrder(rejectedPhase(seed).id);
    const res = await page.request.post(`/api/admin/orders/${order.id}/reject`, {
      data: { reason: "Nochmal ablehnen" },
    });
    expect(res.status()).toBe(409);
  });

  test("permission boundary: a role without orders.reject gets 403", async ({ seed, browser }) => {
    const role = await createTestTeamRole({
      restricted: false,
      permissions: ["orders.edit"], // no orders.reject
    });
    const user = await createTestUser({ email: "keinreject@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, user.email);
    const res = await page.request.post(`/api/admin/orders/${order.id}/reject`, {
      data: { reason: "Darf ich nicht" },
    });
    expect(res.status()).toBe(403);
    await context.close();

    const unchanged = await prismaTest.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.rejectedAt).toBeNull();
  });

  test("reversible: moving out of the rejected phase clears reason + archive", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id);
    const rejectRes = await page.request.post(`/api/admin/orders/${order.id}/reject`, {
      data: { reason: "Erstmal weg" },
    });
    expect(rejectRes.status()).toBe(200);

    const restoreRes = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[0].id },
    });
    expect(restoreRes.status()).toBe(200);

    const restored = await prismaTest.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(restored.phaseId).toBe(seed.phases[0].id);
    expect(restored.rejectedAt).toBeNull();
    expect(restored.rejectionReason).toBeNull();
    expect(restored.archivedAt).toBeNull();
  });
});

test.describe("Reject an order — UI", () => {
  test("declines an order via the overflow menu and shows it on tracking", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, { customerName: "UI Ablehnung" });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByTestId("order-overflow-menu").click();
    await page.getByTestId("order-reject-trigger").click();
    await page.getByTestId("order-reject-reason").fill("Außerhalb unseres Leistungsspektrums");

    const rejectResponse = page.waitForResponse(
      (r) => r.url().includes(`/api/admin/orders/${order.id}/reject`) && r.request().method() === "POST"
    );
    await page.getByRole("alertdialog").getByRole("button", { name: /Auftrag ablehnen/i }).click();
    expect((await rejectResponse).status()).toBe(200);

    const updated = await prismaTest.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.rejectionReason).toBe("Außerhalb unseres Leistungsspektrums");

    // Customer-facing tracking page reflects the declined state + reason.
    await page.goto(`/track/${updated.trackingToken}`);
    await expect(page.getByTestId("tracking-rejected-banner")).toBeVisible();
    await expect(page.getByTestId("tracking-rejected-banner")).toContainText("Außerhalb unseres Leistungsspektrums");
  });
});

test.describe("Put an order on hold", () => {
  test("moving into the on-hold phase keeps the order active (not archived)", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id);

    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: onHoldPhase(seed).id },
    });
    expect(res.status()).toBe(200);

    const updated = await prismaTest.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { phase: true },
    });
    expect(updated.phase.isOnHold).toBe(true);
    expect(updated.archivedAt).toBeNull();
    expect(updated.rejectedAt).toBeNull();
  });
});
