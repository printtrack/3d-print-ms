import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestVerification } from "../fixtures/db";

async function getDefaultPhase() {
  return prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
}

test("tracking page shows approve/reject for PENDING DESIGN_REVIEW", async ({ seed, page }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Verify Pending" });
  await createTestVerification(order.id, "DESIGN_REVIEW");

  await page.goto(`/track/${order.trackingToken}`);
  await expect(page.getByText("Handlung erforderlich:")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Bitte geben Sie das Design frei")).toBeVisible();
  await expect(page.getByRole("button", { name: /Freigabe erteilen/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ablehnen/i })).toBeVisible();
});

test("customer can approve DESIGN_REVIEW", async ({ seed, page }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Approve Verify" });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW");

  await page.goto(`/track/${order.trackingToken}`);
  await page.getByRole("button", { name: /Freigabe erteilen/i }).click();
  await expect(page.getByText("Freigegeben").first()).toBeVisible({ timeout: 5000 });

  const updated = await prismaTest.verificationRequest.findUnique({ where: { id: vr.id } });
  expect(updated?.status).toBe("APPROVED");
  expect(updated?.resolvedAt).toBeTruthy();
});

test("customer can reject DESIGN_REVIEW", async ({ seed, page }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Reject Verify" });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW");

  await page.goto(`/track/${order.trackingToken}`);
  await page.getByRole("button", { name: /Ablehnen/i }).click();
  await expect(page.getByText("Abgelehnt").first()).toBeVisible({ timeout: 5000 });

  const updated = await prismaTest.verificationRequest.findUnique({ where: { id: vr.id } });
  expect(updated?.status).toBe("REJECTED");
});

test("tracking page shows PRICE_APPROVAL with price", async ({ seed, page }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Price Verify" });
  // Approve design review first
  await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "DESIGN_REVIEW", status: "APPROVED", resolvedAt: new Date() },
  });
  await createTestVerification(order.id, "PRICE_APPROVAL");
  // Set a price on the order
  await prismaTest.order.update({ where: { id: order.id }, data: { priceEstimate: 49.99 } });

  await page.goto(`/track/${order.trackingToken}`);
  await expect(page.getByText("Handlung erforderlich:")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Bitte bestätigen Sie das Angebot")).toBeVisible();
  await expect(page.getByText(/49\.99/)).toBeVisible();
});

test("double-submit returns 409", async ({ seed, request }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Double Submit" });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW");

  const res1 = await request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: { verificationToken: vr.token, action: "APPROVE" },
  });
  expect(res1.status()).toBe(200);

  const res2 = await request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: { verificationToken: vr.token, action: "APPROVE" },
  });
  expect(res2.status()).toBe(409);
});

test("unknown verification token returns 404", async ({ seed, request }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Unknown Token" });

  const res = await request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: { verificationToken: "nonexistent-token-12345", action: "APPROVE" },
  });
  expect(res.status()).toBe(404);
});

test("resolved verification shows status, no action buttons", async ({ seed, page }) => {
  const phase = await getDefaultPhase();
  if (!phase) { test.skip(); return; }

  const order = await createTestOrder(phase.id, { customerName: "Resolved Verify" });
  await prismaTest.verificationRequest.create({
    data: {
      orderId: order.id,
      type: "DESIGN_REVIEW",
      status: "APPROVED",
      resolvedAt: new Date(),
    },
  });

  await page.goto(`/track/${order.trackingToken}`);
  await expect(page.getByText("Freigaben")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Freigegeben").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Freigabe erteilen/i })).not.toBeVisible();
});
