import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.describe("Kanban sort order", () => {
  let phaseId: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");
    phaseId = phase.id;
  });

  test("initial order respects deadline: nearest deadline appears first", async ({ page }) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await createTestOrder(phaseId, { customerName: "Sort Later Deadline", deadline: later });
    await createTestOrder(phaseId, { customerName: "Sort Soon Deadline", deadline: soon });

    await page.goto("/admin/orders");
    await expect(page.getByText("Sort Soon Deadline").first()).toBeVisible();
    await expect(page.getByText("Sort Later Deadline").first()).toBeVisible();

    const column = page.locator(`#column-${phaseId}`);
    const cards = column.locator('[id^="order-"]');
    await expect(cards.first()).toContainText("Sort Soon Deadline");
    await expect(cards.nth(1)).toContainText("Sort Later Deadline");
  });

  test("reorder API sets phaseOrder on orders", async ({ request }) => {
    const orderA = await createTestOrder(phaseId, { customerName: "Reorder A" });
    const orderB = await createTestOrder(phaseId, { customerName: "Reorder B" });
    const orderC = await createTestOrder(phaseId, { customerName: "Reorder C" });

    const res = await request.post("/api/admin/orders/reorder", {
      data: { phaseId, orderIds: [orderC.id, orderA.id, orderB.id] },
    });
    expect(res.status()).toBe(200);

    const updated = await prismaTest.order.findMany({
      where: { id: { in: [orderA.id, orderB.id, orderC.id] } },
      select: { id: true, phaseOrder: true },
    });

    const byId = Object.fromEntries(updated.map((o) => [o.id, o.phaseOrder]));
    expect(byId[orderC.id]).toBe(0);
    expect(byId[orderA.id]).toBe(1);
    expect(byId[orderB.id]).toBe(2);
  });

  test("persisted phaseOrder is respected on reload", async ({ page }) => {
    const orderA = await createTestOrder(phaseId, { customerName: "Persist Order A" });
    const orderB = await createTestOrder(phaseId, { customerName: "Persist Order B" });

    await prismaTest.order.update({ where: { id: orderA.id }, data: { phaseOrder: 1 } });
    await prismaTest.order.update({ where: { id: orderB.id }, data: { phaseOrder: 0 } });

    await page.goto("/admin/orders");
    await expect(page.getByText("Persist Order B").first()).toBeVisible();

    const column = page.locator(`#column-${phaseId}`);
    const cards = column.locator('[id^="order-"]');
    await expect(cards.first()).toContainText("Persist Order B");
    await expect(cards.nth(1)).toContainText("Persist Order A");
  });

  test("intra-column drag reorder persists after page reload", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    const orderFirst = await createTestOrder(phaseId, { customerName: "Drag First Card" });
    const orderSecond = await createTestOrder(phaseId, { customerName: "Drag Second Card" });

    await prismaTest.order.update({ where: { id: orderFirst.id }, data: { phaseOrder: 0 } });
    await prismaTest.order.update({ where: { id: orderSecond.id }, data: { phaseOrder: 1 } });

    await page.goto("/admin/orders");
    await expect(page.getByText("Drag First Card").first()).toBeVisible();
    await expect(page.getByText("Drag Second Card").first()).toBeVisible();

    const firstCardEl = page.locator(`#order-${orderFirst.id}`);
    const secondCardEl = page.locator(`#order-${orderSecond.id}`);

    const firstBox = await firstCardEl.boundingBox();
    const secondBox = await secondCardEl.boundingBox();
    if (!firstBox || !secondBox) throw new Error("Cards not found");

    const startX = firstBox.x + firstBox.width / 2;
    const startY = firstBox.y + firstBox.height / 2;
    const endX = secondBox.x + secondBox.width / 2;
    const endY = secondBox.y + secondBox.height + 10;

    const reorderDone = page.waitForResponse(
      (r) => r.url().includes("/api/admin/orders/reorder") && r.request().method() === "POST"
    );
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 5, { steps: 3 });
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.mouse.up();

    await reorderDone;

    const updated = await prismaTest.order.findMany({
      where: { id: { in: [orderFirst.id, orderSecond.id] } },
      select: { id: true, phaseOrder: true },
    });
    const byId = Object.fromEntries(updated.map((o) => [o.id, o.phaseOrder]));
    expect(byId[orderSecond.id]).toBeLessThan(byId[orderFirst.id]!);

    await page.reload();
    await expect(page.getByText("Drag Second Card").first()).toBeVisible();

    const column = page.locator(`#column-${phaseId}`);
    const cards = column.locator('[id^="order-"]');
    await expect(cards.first()).toContainText("Drag Second Card");
  });

  test("reorder endpoint rejects invalid phaseId", async ({ request, seed }) => {
    const order = await createTestOrder(phaseId, { customerName: "Invalid Phase Test" });

    const res = await request.post("/api/admin/orders/reorder", {
      data: { phaseId: "nonexistent-phase-id", orderIds: [order.id] },
    });
    expect(res.status()).toBe(400);
  });
});
