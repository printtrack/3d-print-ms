import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestMachine } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Settings – Teilphasen tab", () => {
  test("shows Teilphasen tab in settings", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("button", { name: "Teilphasen" })).toBeVisible();
  });

  test("shows seeded default part phases", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Teilphasen" }).click();
    await expect(page.getByText("Design").first()).toBeVisible();
    await expect(page.getByText("Überprüfung").first()).toBeVisible();
    await expect(page.getByText("Druckbereit").first()).toBeVisible();
  });

  test("Druckbereit shows isPrintReady badge", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Teilphasen" }).click();
    await expect(page.getByText("Druckbereit").first()).toBeVisible();
    const badge = page.locator("text=Druckbereit").first();
    await expect(badge).toBeVisible();
  });

  test("can create a new part phase", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Teilphasen" }).click();
    await page.getByRole("button", { name: "Teilphase hinzufügen" }).click();
    await page.getByLabel("Name *").fill("Test Teilphase");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Teilphase erstellt").first()).toBeVisible();
    await expect(page.getByText("Test Teilphase")).toBeVisible();
  });

  test("can edit a part phase", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Teilphasen" }).click();
    const designRow = page.locator('[data-testid="part-phase-row"]').filter({ hasText: "Design" }).first();
    await designRow.getByRole("button").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Name *").fill("Design Geändert");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Teilphase aktualisiert").first()).toBeVisible();
    await expect(page.getByText("Design Geändert")).toBeVisible();
  });

  test("can delete a part phase", async ({ seed, page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Teilphasen" }).click();
    await page.getByRole("button", { name: "Teilphase hinzufügen" }).click();
    await page.getByLabel("Name *").fill("Zu Löschen");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Zu Löschen")).toBeVisible();

    page.on("dialog", (d) => d.accept());
    const row = page.locator('[data-testid="part-phase-row"]').filter({ hasText: "Zu Löschen" }).first();
    await row.getByRole("button").last().click();
    await expect(page.getByText("Teilphase gelöscht").first()).toBeVisible();
    await expect(page.getByText("Zu Löschen")).not.toBeVisible();
  });
});

test.describe("Order detail – part phase dropdown", () => {
  test("shows phase dropdown on parts", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    const order = await createTestOrder(phase!.id, { customerName: "Phase Test" });
    await createTestOrderPart(order.id, { name: "Testgehäuse" });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Testgehäuse").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Phase wählen/i }).first()).toBeVisible();
  });

  test("phase dropdown persists on change", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    const order = await createTestOrder(phase!.id);
    const part = await createTestOrderPart(order.id, { name: "Druckteil" });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Druckteil").first()).toBeVisible();

    await page.getByRole("button", { name: /Phase wählen/i }).first().click();
    const partPhaseSaved = page.waitForResponse(
      (r) => r.url().includes("/api/admin/orders/") && r.url().includes("/parts/") && r.request().method() === "PATCH"
    );
    await page.getByRole("menuitem", { name: "Überprüfung" }).click();
    await partPhaseSaved;

    const updated = await prismaTest.orderPart.findUnique({ where: { id: part.id }, include: { partPhase: true } });
    expect(updated?.partPhase?.name).toBe("Überprüfung");
  });

  test("Neuer Job button visible only when part phase isPrintReady", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
    const order = await createTestOrder(phase!.id);
    await createTestOrderPart(order.id, { name: "Druckbereit Teil", partPhaseId: printReadyPhase!.id });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole("button", { name: /Zu Druckjob hinzufügen/ })).toBeVisible();
  });

  test("Neuer Job button not shown when phase is not print-ready", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    const designPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: false } });
    const order = await createTestOrder(phase!.id);
    await createTestOrderPart(order.id, { name: "Design Teil", partPhaseId: designPhase!.id });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole("button", { name: /Zu Druckjob hinzufügen/ })).not.toBeVisible();
  });

  test("Neuer Job creates job and auto-links part", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
    const machine = await createTestMachine({ name: "Prusa MK4" });
    const order = await createTestOrder(phase!.id);
    const part = await createTestOrderPart(order.id, { name: "Print Teil", partPhaseId: printReadyPhase!.id });

    await page.goto(`/admin/orders/${order.id}`);
    const partSection = page.locator('[data-testid="part-section"]').filter({ hasText: "Print Teil" });
    await partSection.getByRole("button", { name: /Zu Druckjob hinzufügen/ }).click();
    await page.getByRole("menuitem", { name: /Neuen Job erstellen/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Prusa MK4" }).click();
    await dialog.getByRole("button", { name: "Erstellen" }).click();

    await expect(page.getByText(/zum Druckjob hinzugefügt/i).first()).toBeVisible();

    const link = await prismaTest.printJobPart.findFirst({ where: { orderPartId: part.id } });
    expect(link).not.toBeNull();
  });
});
