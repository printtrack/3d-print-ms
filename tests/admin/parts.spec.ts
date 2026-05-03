import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestFilament } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("parts are collapsed by default when multiple parts exist", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Collapsed Test" });
  const part1 = await createTestOrderPart(order.id, { name: "Gehäuse" });
  const part2 = await createTestOrderPart(order.id, { name: "Deckel" });

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  // Part headers are visible
  await expect(page.getByText("Gehäuse")).toBeVisible();
  await expect(page.getByText("Deckel")).toBeVisible();

  // File drop zones should NOT be visible (sections are collapsed)
  const sections = page.locator('[data-testid="part-section"]');
  await expect(sections).toHaveCount(2);
  // FileDropZone is inside the collapsed body — not rendered at all
  for (const section of await sections.all()) {
    await expect(section.getByText("Dateien hier ablegen oder klicken")).not.toBeVisible();
  }
});

test("part expands on header click", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Expand Test" });
  await createTestOrderPart(order.id, { name: "Klammer" });
  await createTestOrderPart(order.id, { name: "Basis" });

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  const section = page.locator('[data-testid="part-section"]').first();
  await section.locator("div.border-b").first().click();
  await expect(section.getByText("Dateien hier ablegen oder klicken")).toBeVisible({ timeout: 3000 });
});

test("filament picker dropdown opens and updates part", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const filament = await createTestFilament({ name: "Test PLA Rot", material: "PLA", colorHex: "#ff0000" });
  const order = await createTestOrder(defaultPhase.id, { customerName: "Filament Picker Test" });
  await createTestOrderPart(order.id, { name: "Nocke" });
  await createTestOrderPart(order.id, { name: "Nocke2" });

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  // Click "Filament wählen" chip in the first part header
  await expect(page.getByText("Filament wählen").first()).toBeVisible();
  await page.getByText("Filament wählen").first().click();

  // Dropdown should show the filament
  await expect(page.getByRole("menuitem", { name: /Test PLA Rot/i }).first()).toBeVisible({ timeout: 3000 });

  // Wait for the PATCH response before checking DB (avoids race between optimistic UI and DB commit)
  const patchDone = page.waitForResponse((r) => r.url().includes("/api/admin/orders/") && r.request().method() === "PATCH");
  await page.getByRole("menuitem", { name: /Test PLA Rot/i }).first().click();
  await patchDone;

  // Chip should now show filament name
  await expect(page.getByText("Test PLA Rot").first()).toBeVisible({ timeout: 5000 });

  // DB should have updated
  const parts = await prismaTest.orderPart.findMany({ where: { orderId: order.id } });
  const updated = parts.find((p) => p.filamentId === filament.id);
  expect(updated).toBeTruthy();
});
