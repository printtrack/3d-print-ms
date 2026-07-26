import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

const DROP_ZONE_TEXT = "Dateien hier ablegen oder klicken";
/** Must stay above SPRING_OPEN_DELAY_MS in PartFileSection.tsx */
const AFTER_SPRING_MS = 1200;

/** A DataTransfer carrying a file, so `types.includes("Files")` is true */
function fileDataTransfer(page: Page) {
  return page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["solid x\nendsolid x\n"], "cube.stl", { type: "model/stl" }));
    return dt;
  });
}

async function orderWithThreeParts(name: string) {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) return null;
  const order = await createTestOrder(defaultPhase.id, { customerName: name });
  await createTestOrderPart(order.id, { name: "Gehäuse" });
  await createTestOrderPart(order.id, { name: "Deckel" });
  await createTestOrderPart(order.id, { name: "Basis" });
  return order;
}

test("dragging a file onto a collapsed part opens it after hovering", async ({ seed, page }) => {
  const order = await orderWithThreeParts("Spring Open");
  if (!order) { test.skip(); return; }

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const section = page.locator('[data-testid="part-section"]').first();
  await expect(section.getByText(DROP_ZONE_TEXT)).toHaveCount(0);

  const dt = await fileDataTransfer(page);
  await section.dispatchEvent("dragenter", { dataTransfer: dt });

  await expect(section.getByText(DROP_ZONE_TEXT)).toBeVisible({ timeout: 3000 });
});

test("dragging past a part without stopping leaves it collapsed", async ({ seed, page }) => {
  const order = await orderWithThreeParts("Spring Pass Through");
  if (!order) { test.skip(); return; }

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const sections = page.locator('[data-testid="part-section"]');
  await expect(sections).toHaveCount(3);

  const dt = await fileDataTransfer(page);
  // Sweep across all three sections quickly, as when aiming at the last one
  for (const section of await sections.all()) {
    await section.dispatchEvent("dragenter", { dataTransfer: dt });
    await section.dispatchEvent("dragleave", { dataTransfer: dt });
  }

  await page.waitForTimeout(AFTER_SPRING_MS);
  for (const section of await sections.all()) {
    await expect(section.getByText(DROP_ZONE_TEXT)).toHaveCount(0);
  }
});

test("a part opened by the drag closes again when the drag leaves", async ({ seed, page }) => {
  const order = await orderWithThreeParts("Spring Close");
  if (!order) { test.skip(); return; }

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const section = page.locator('[data-testid="part-section"]').first();
  const dt = await fileDataTransfer(page);

  await section.dispatchEvent("dragenter", { dataTransfer: dt });
  await expect(section.getByText(DROP_ZONE_TEXT)).toBeVisible({ timeout: 3000 });

  await section.dispatchEvent("dragleave", { dataTransfer: dt });
  await expect(section.getByText(DROP_ZONE_TEXT)).toHaveCount(0);
});

test("a manually expanded part stays open when a drag passes through", async ({ seed, page }) => {
  const order = await orderWithThreeParts("Manual Expand Kept");
  if (!order) { test.skip(); return; }

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const section = page.locator('[data-testid="part-section"]').first();
  await section.locator("div.border-b").first().click();
  await expect(section.getByText(DROP_ZONE_TEXT)).toBeVisible({ timeout: 3000 });

  const dt = await fileDataTransfer(page);
  await section.dispatchEvent("dragenter", { dataTransfer: dt });
  await page.waitForTimeout(AFTER_SPRING_MS);
  await section.dispatchEvent("dragleave", { dataTransfer: dt });

  await expect(section.getByText(DROP_ZONE_TEXT)).toBeVisible();
});

test("dropping on a collapsed part uploads into that part", async ({ seed, page }) => {
  const order = await orderWithThreeParts("Drop While Collapsed");
  if (!order) { test.skip(); return; }

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const section = page.locator('[data-testid="part-section"]').first();
  const dt = await fileDataTransfer(page);

  const upload = page.waitForResponse(
    (r) => r.url().includes("/api/admin/uploads") && r.request().method() === "POST"
  );
  await section.dispatchEvent("drop", { dataTransfer: dt });
  const res = await upload;
  expect(res.status()).toBeLessThan(400);

  const files = await prismaTest.orderFile.findMany({ where: { orderId: order.id } });
  expect(files.length).toBe(1);
  expect(files[0].orderPartId).not.toBeNull();
});
