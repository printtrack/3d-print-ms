import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestFilament, createTestPrintReadyPart } from "../fixtures/db";

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

test("material and color can be selected separately (happy path)", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  await createTestFilament({ name: "Test PLA Rot", material: "PLA", color: "Rot", colorHex: "#ff0000", remainingGrams: 800 });
  const order = await createTestOrder(defaultPhase.id, { customerName: "Material Picker Test" });
  const part = await createTestOrderPart(order.id, { name: "Nocke" });

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  // Material badge → pick PLA
  const materialBadge = page.locator('[data-tutorial="filament-btn"]').first();
  await expect(materialBadge).toBeVisible();
  await materialBadge.click();
  const patchMat = page.waitForResponse((r) => r.url().includes(`/parts/${part.id}`) && r.request().method() === "PATCH");
  await page.getByRole("menuitem", { name: /PLA/i }).first().click();
  await patchMat;

  // Color badge (now enabled) → pick Rot
  await page.getByRole("button", { name: "Farbe" }).first().click();
  const patchColor = page.waitForResponse((r) => r.url().includes(`/parts/${part.id}`) && r.request().method() === "PATCH");
  await page.getByRole("menuitem", { name: /Rot/i }).first().click();
  await patchColor;

  const updated = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updated?.material).toBe("PLA");
  expect(updated?.color).toBe("Rot");
  expect(updated?.colorHex).toBe("#ff0000");
});

test("material can be set to 'egal' (any)", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  await createTestFilament({ name: "Test PLA Weiß", material: "PLA", color: "Weiß", colorHex: "#ffffff" });
  const order = await createTestOrder(defaultPhase.id, { customerName: "Egal Test" });
  const part = await createTestOrderPart(order.id, { name: "Anhänger" });

  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  await page.locator('[data-tutorial="filament-btn"]').first().click();
  const patchDone = page.waitForResponse((r) => r.url().includes(`/parts/${part.id}`) && r.request().method() === "PATCH");
  await page.getByRole("menuitem", { name: /Egal/i }).first().click();
  await patchDone;

  const updated = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updated?.materialAny).toBe(true);
  expect(updated?.material).toBeNull();
});

test("part duplicate creates a color variant with cleared color", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  // Print-ready part comes with a real STL DESIGN file on disk.
  const { part } = await createTestPrintReadyPart({
    material: "PLA", color: "Rot", colorHex: "#ff0000", quantity: 3, name: "Schlüsselanhänger",
  });
  const orderId = part.orderId;

  const res = await page.request.post(`/api/admin/orders/${orderId}/parts/${part.id}/duplicate`);
  expect(res.status()).toBe(201);
  const cloneRes = await res.json();

  const parts = await prismaTest.orderPart.findMany({ where: { orderId } });
  expect(parts).toHaveLength(2);
  const source = parts.find((p) => p.id === part.id)!;
  const clone = parts.find((p) => p.id !== part.id)!;
  expect(clone.name).toBe("Schlüsselanhänger");
  expect(clone.material).toBe("PLA");
  expect(clone.quantity).toBe(3);
  expect(clone.color).toBeNull();
  expect(clone.colorHex).toBeNull();

  // Variants share one design group (no file copied to the clone).
  expect(source.variantGroupId).toBeTruthy();
  expect(clone.variantGroupId).toBe(source.variantGroupId);
  const cloneOwnFiles = await prismaTest.orderFile.findMany({ where: { orderPartId: clone.id } });
  expect(cloneOwnFiles).toHaveLength(0);
  // The duplicate response carries the shared design so the UI shows the STL.
  expect((cloneRes.files ?? []).some((f: { filename: string }) => f.filename.endsWith(".stl"))).toBe(true);

  // Detach the clone → it gets its own copy and leaves the group.
  const detachRes = await page.request.post(`/api/admin/orders/${orderId}/parts/${clone.id}/detach-design`);
  expect(detachRes.ok()).toBeTruthy();
  const detached = await prismaTest.orderPart.findUnique({ where: { id: clone.id } });
  expect(detached?.variantGroupId).toBeNull();
  const cloneFilesAfter = await prismaTest.orderFile.findMany({ where: { orderPartId: clone.id, category: "DESIGN" } });
  expect(cloneFilesAfter.length).toBeGreaterThan(0);
});

test("part duplicate requires authentication", async ({ seed, browser }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Auth Test" });
  const part = await createTestOrderPart(order.id, { name: "Teil" });

  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await anon.request.post(`/api/admin/orders/${order.id}/parts/${part.id}/duplicate`);
  expect(res.status()).toBe(401);
  await anon.close();
});

test("new parts default to material/color 'egal'", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "Egal Default" });
  const res = await page.request.post(`/api/admin/orders/${order.id}/parts`, {
    data: { name: "Neues Teil" },
  });
  expect(res.status()).toBe(201);
  const part = await res.json();
  expect(part.materialAny).toBe(true);
  expect(part.colorAny).toBe(true);
  expect(part.material).toBeNull();
  expect(part.color).toBeNull();
});
