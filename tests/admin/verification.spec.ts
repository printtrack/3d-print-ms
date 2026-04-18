import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestVerification } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("order detail: verification section always visible with two rows", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Visible Test" });

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Freigaben", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Designfreigabe", { exact: true })).toBeVisible();
  await expect(page.getByText("Angebotsfreigabe", { exact: true })).toBeVisible();
});

test("order detail: verification section with admin override", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Admin Test" });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW");

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Freigaben", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Ausstehend").first()).toBeVisible();

  const overrideBtn = page.getByRole("button", { name: /Admin-Freigabe erteilen/i }).first();
  await expect(overrideBtn).toBeVisible();
  await overrideBtn.click();

  await expect(page.getByText("Freigegeben").first()).toBeVisible({ timeout: 10000 });

  const updated = await prismaTest.verificationRequest.findUnique({ where: { id: vr.id } });
  expect(updated?.status).toBe("APPROVED");
  expect(updated?.resolvedBy).toBeTruthy();
});

test("kanban: order card shows pending verification badge", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Badge Test" });
  await createTestVerification(order.id, "DESIGN_REVIEW");

  await page.goto("/admin/orders");
  const card = page.locator(`#order-${order.id}`);
  await expect(card.getByText("Freigabe ausstehend")).toBeVisible({ timeout: 5000 });
});

test("order detail: 'Freigabe senden' button sends DESIGN_REVIEW", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Trigger Test" });

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Freigaben", { exact: true })).toBeVisible({ timeout: 5000 });
  const sendBtn = page.getByRole("button", { name: /Freigabe senden/i }).first();
  await expect(sendBtn).toBeVisible();

  await sendBtn.click();

  await expect(page.getByText("Ausstehend").first()).toBeVisible({ timeout: 10000 });

  const vr = await prismaTest.verificationRequest.findFirst({
    where: { orderId: order.id, type: "DESIGN_REVIEW" },
  });
  expect(vr?.status).toBe("PENDING");
});

test("order detail: 'Freigabe senden' re-enabled after DESIGN_REVIEW rejection", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Reject Test" });
  await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "DESIGN_REVIEW", status: "REJECTED", resolvedAt: new Date() },
  });

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Freigaben", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Abgelehnt").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Freigabe senden/i }).first()).toBeVisible();
});

test("kanban: forward drag blocked by server 409", async ({ seed, request }) => {
  const phases = await prismaTest.orderPhase.findMany({ orderBy: { position: "asc" } });
  if (phases.length < 2) { test.skip(); return; }

  const order = await createTestOrder(phases[0].id, { customerName: "Block Drag Test" });
  await createTestVerification(order.id, "DESIGN_REVIEW");

  const res = await request.patch(`/api/admin/orders/${order.id}`, {
    data: { phaseId: phases[1].id },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toContain("Freigabe");
});

test("PRICE_APPROVAL blocked without DESIGN_REVIEW approval via API", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Sequential Block Test" });

  const res = await request.post(`/api/admin/orders/${order.id}/verify`, {
    data: { type: "PRICE_APPROVAL" },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("Design");
});

test("PRICE_APPROVAL can be sent after DESIGN_REVIEW approved via API", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Sequential Allow Test" });
  await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "DESIGN_REVIEW", status: "APPROVED", resolvedAt: new Date() },
  });

  const res = await request.post(`/api/admin/orders/${order.id}/verify`, {
    data: { type: "PRICE_APPROVAL" },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.type).toBe("PRICE_APPROVAL");
});
