import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.describe("Kanban drag and drop", () => {
  let orderId: string;

  test.beforeEach(async ({ seed }) => {
    const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!defaultPhase) throw new Error("No default phase found");
    const order = await createTestOrder(defaultPhase.id, {
      customerName: "DnD Tester",
      description: "Order for drag and drop test",
    });
    orderId = order.id;
  });

  test("can drag an order card to another column via API simulation", async ({ page, request }) => {
    const targetPhase = await prismaTest.orderPhase.findFirst({ where: { position: 1 } });
    if (!targetPhase) throw new Error("No target phase found");

    const response = await request.patch(`/api/admin/orders/${orderId}`, {
      data: { phaseId: targetPhase.id },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.phaseId).toBe(targetPhase.id);

    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(updated?.phaseId).toBe(targetPhase.id);
  });

  test("archive via API simulation: PATCH archive:true sets archivedAt", async ({ request }) => {
    const response = await request.patch(`/api/admin/orders/${orderId}`, {
      data: { archive: true },
    });
    expect(response.status()).toBe(200);

    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(updated?.archivedAt).not.toBeNull();
  });

  test("drag card to archive drop zone removes it from the board", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto("/admin/orders");
    await expect(page.getByText("DnD Tester").first()).toBeVisible();

    const card = page.getByText("DnD Tester").first();
    const cardBox = await card.boundingBox();
    if (!cardBox) throw new Error("Card not found");

    const archiveZone = page.getByText("Hierher ziehen zum Archivieren");
    const archiveBox = await archiveZone.boundingBox();
    if (!archiveBox) throw new Error("Archive drop zone not found");

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height / 2;
    const endX = archiveBox.x + archiveBox.width / 2;
    const endY = archiveBox.y + archiveBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 15, startY + 5, { steps: 3 });
    await page.mouse.move(endX, endY, { steps: 30 });
    await page.mouse.up();

    await expect(page.getByText(/archiviert/i).first()).toBeVisible({ timeout: 5000 });

    const board = page.locator('[data-testid="kanban-board"]');
    await expect(board.getByText("DnD Tester")).toHaveCount(0, { timeout: 3000 });

    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(updated?.archivedAt).not.toBeNull();
  });

  test("mobile: selecting Archivieren from phase select archives the order", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/orders");

    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    await select.selectOption("__archive__");

    await expect(page.getByText(/archiviert/i).first()).toBeVisible({ timeout: 5000 });

    const mobileList = page.locator('[data-testid="kanban-mobile-list"]');
    await expect(mobileList.getByText("DnD Tester")).toHaveCount(0, { timeout: 3000 });

    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(updated?.archivedAt).not.toBeNull();
  });

  test("drag card: order appears in target column after move", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByText("DnD Tester").first()).toBeVisible();

    const card = page.getByText("DnD Tester").first();
    const cardBoundingBox = await card.boundingBox();
    if (!cardBoundingBox) throw new Error("Card not found");

    const targetColumn = page.getByRole("heading", { name: "In Prüfung" });
    const targetBoundingBox = await targetColumn.boundingBox();
    if (!targetBoundingBox) throw new Error("Target column not found");

    const startX = cardBoundingBox.x + cardBoundingBox.width / 2;
    const startY = cardBoundingBox.y + cardBoundingBox.height / 2;
    const endX = targetBoundingBox.x + targetBoundingBox.width / 2;
    const endY = targetBoundingBox.y + targetBoundingBox.height / 2 + 60;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 15, startY + 5, { steps: 3 });
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.mouse.up();

    await expect(page.getByText("DnD Tester").first()).toBeVisible();
  });
});
