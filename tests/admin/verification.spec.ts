import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestVerification } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("order detail: Angebotsfreigabe card always visible", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Visible Test" });

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Angebotsfreigabe", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Erst nach Designfreigabe verfügbar")).toBeVisible();
});

test("order detail: admin approves per-part VR via inline button", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Admin Test" });
  const part = await createTestOrderPart(order.id);
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  await page.goto(`/admin/orders/${order.id}`);

  // VR banner is inside the part header — visible even when section is collapsed
  await expect(page.getByText("Designfreigabe ausstehend").first()).toBeVisible({ timeout: 5000 });

  const overrideBtn = page.getByRole("button", { name: /^Erteilen$/i }).first();
  await expect(overrideBtn).toBeVisible();
  await overrideBtn.click();

  // Banner disappears and part phase auto-changes to Druckbereit
  await expect(page.getByText("Designfreigabe ausstehend")).not.toBeVisible({ timeout: 10000 });

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

test("order detail: per-part pending VR shows inline action buttons", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Trigger Test" });
  const part = await createTestOrderPart(order.id);
  await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Designfreigabe ausstehend").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: /^Erteilen$/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ablehnen$/i }).first()).toBeVisible();
});

test("order detail: per-part rejected VR shows rejection reason inline", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Freigabe Reject Test" });
  const part = await createTestOrderPart(order.id);
  await prismaTest.verificationRequest.create({
    data: {
      orderId: order.id,
      orderPartId: part.id,
      type: "DESIGN_REVIEW",
      status: "REJECTED",
      resolvedAt: new Date(),
      rejectionReason: "Maße stimmen nicht",
    },
  });

  await page.goto(`/admin/orders/${order.id}`);

  await expect(page.getByText("Abgelehnt").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Maße stimmen nicht")).toBeVisible();
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

test("per-part design review auto-created when part enters review phase (non-prototype)", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const reviewPhase = await prismaTest.partPhase.findFirst({ where: { isReview: true } });
  if (!defaultPhase || !reviewPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { isPrototype: false });
  const part = await createTestOrderPart(order.id);

  const res = await request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { partPhaseId: reviewPhase.id },
  });
  expect(res.status()).toBe(200);

  const vr = await prismaTest.verificationRequest.findFirst({
    where: { orderId: order.id, orderPartId: part.id, type: "DESIGN_REVIEW" },
  });
  expect(vr).not.toBeNull();
  expect(vr?.status).toBe("PENDING");
});

test("per-part design review NOT auto-created when order is in prototype mode", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const reviewPhase = await prismaTest.partPhase.findFirst({ where: { isReview: true } });
  if (!defaultPhase || !reviewPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { isPrototype: true });
  const part = await createTestOrderPart(order.id);

  await request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { partPhaseId: reviewPhase.id },
  });

  const vr = await prismaTest.verificationRequest.findFirst({
    where: { orderId: order.id, orderPartId: part.id },
  });
  expect(vr).toBeNull();
});

test("per-part design review not duplicated if already PENDING", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const reviewPhase = await prismaTest.partPhase.findFirst({ where: { isReview: true } });
  if (!defaultPhase || !reviewPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { isPrototype: false });
  const part = await createTestOrderPart(order.id);
  await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  await request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { partPhaseId: reviewPhase.id },
  });

  const count = await prismaTest.verificationRequest.count({
    where: { orderId: order.id, orderPartId: part.id, type: "DESIGN_REVIEW" },
  });
  expect(count).toBe(1);
});

test("upload DESIGN file does NOT auto-create a VerificationRequest", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { isPrototype: false });

  // Simulate what the admin upload route checks: no VR should be created just by a PATCH on an order
  // We verify the trigger was removed by confirming no order-level VR exists after a part PATCH without isReview phase
  const designPhase = await prismaTest.partPhase.findFirst({ where: { isDefault: true } });
  const part = await createTestOrderPart(order.id);
  if (designPhase) {
    await request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
      data: { partPhaseId: designPhase.id },
    });
  }

  const vr = await prismaTest.verificationRequest.findFirst({
    where: { orderId: order.id, type: "DESIGN_REVIEW" },
  });
  expect(vr).toBeNull();
});

test("admin approves per-part VR → part phase auto-set to isPrintReady", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  if (!defaultPhase || !printReadyPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id);
  const part = await createTestOrderPart(order.id);
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  const res = await request.patch(`/api/admin/orders/${order.id}/verify`, {
    data: { verificationRequestId: vr.id, action: "APPROVE" },
  });
  expect(res.status()).toBe(200);

  const updatedPart = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updatedPart?.partPhaseId).toBe(printReadyPhase.id);
});

test("admin rejects per-part VR → rejectionReason saved and part phase reset to default", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const defaultPartPhase = await prismaTest.partPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase || !defaultPartPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id);
  const part = await createTestOrderPart(order.id);
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  const res = await request.patch(`/api/admin/orders/${order.id}/verify`, {
    data: { verificationRequestId: vr.id, action: "REJECT", message: "Maßangaben falsch" },
  });
  expect(res.status()).toBe(200);

  const updated = await prismaTest.verificationRequest.findUnique({ where: { id: vr.id } });
  expect(updated?.status).toBe("REJECTED");
  expect(updated?.rejectionReason).toBe("Maßangaben falsch");

  const updatedPart = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updatedPart?.partPhaseId).toBe(defaultPartPhase.id);
});

test("cannot set isPrintReady phase when PENDING design review exists", async ({ seed, request }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  if (!defaultPhase || !printReadyPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id);
  const part = await createTestOrderPart(order.id);
  await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  const res = await request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { partPhaseId: printReadyPhase.id },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toContain("Designfreigabe");
});

test("customer approves design → admin order detail updates part phase live (SSE)", async ({ seed, page }) => {
  const defaultOrderPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  const reviewPhase = await prismaTest.partPhase.findFirst({ where: { isReview: true } });
  if (!defaultOrderPhase || !printReadyPhase || !reviewPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultOrderPhase.id, { customerName: "SSE Approval Test" });
  const part = await createTestOrderPart(order.id, { partPhaseId: reviewPhase.id });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  // Wait for SSE connection to be established before navigating so we don't miss the event
  const sseReady = page.waitForResponse(resp => resp.url().includes("/api/admin/events") && resp.status() === 200);
  await page.goto(`/admin/orders/${order.id}`);
  await sseReady;

  await expect(page.getByText("Designfreigabe ausstehend").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(printReadyPhase.name).first()).not.toBeVisible();

  // Call verify from within the browser so the SSE event reaches the same EventSource
  await page.evaluate(
    async ({ trackingToken, vrToken }) => {
      await fetch(`/api/orders/${trackingToken}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken: vrToken, action: "APPROVE" }),
      });
    },
    { trackingToken: order.trackingToken, vrToken: vr.token }
  );

  // Part phase label must update without manual reload via SSE → router.refresh()
  await expect(page.getByText(printReadyPhase.name).first()).toBeVisible({ timeout: 10000 });
});

test("customer rejects design → admin order detail updates VR status live (SSE)", async ({ seed, page }) => {
  const defaultOrderPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const reviewPhase = await prismaTest.partPhase.findFirst({ where: { isReview: true } });
  if (!defaultOrderPhase || !reviewPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultOrderPhase.id, { customerName: "SSE Rejection Test" });
  const part = await createTestOrderPart(order.id, { partPhaseId: reviewPhase.id });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW", part.id);

  const sseReady = page.waitForResponse(resp => resp.url().includes("/api/admin/events") && resp.status() === 200);
  await page.goto(`/admin/orders/${order.id}`);
  await sseReady;

  await expect(page.getByText("Designfreigabe ausstehend").first()).toBeVisible({ timeout: 5000 });

  await page.evaluate(
    async ({ trackingToken, vrToken }) => {
      await fetch(`/api/orders/${trackingToken}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken: vrToken, action: "REJECT", rejectionReason: "Maße stimmen nicht" }),
      });
    },
    { trackingToken: order.trackingToken, vrToken: vr.token }
  );

  // VR status must update live without reload: banner disappears, rejected badge appears
  await expect(page.getByText("Designfreigabe ausstehend")).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Abgelehnt").first()).toBeVisible();
});
