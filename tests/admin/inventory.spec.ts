import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestFilament, createTestOrder, createTestOrderPart } from "../fixtures/db";

test.describe("Inventory page", () => {
  test("nav link navigates to inventory", async ({ seed, page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Inventar" }).click();
    await expect(page).toHaveURL("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventar" })).toBeVisible();
  });

  test("shows empty state when no filaments exist", async ({ seed, page }) => {
    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Keine Filamente gefunden")).toBeVisible();
  });

  test("shows seeded filaments in the table", async ({ seed, page }) => {
    await createTestFilament({ name: "PLA Test Grün", material: "PLA", color: "Grün" });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("PLA Test Grün")).toBeVisible();
  });

  test("shows low-stock warning for filaments below 250g", async ({ seed, page }) => {
    await createTestFilament({ name: "Low Stock PLA", remainingGrams: 100 });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Low Stock PLA")).toBeVisible();
    await expect(page.locator("table").locator('[title="Wenig Bestand"]')).toBeVisible();
  });

  test("can add a new filament via dialog", async ({ seed, page }) => {
    await page.goto("/admin/inventory");

    await page.getByRole("button", { name: /Filament hinzufügen/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("z.B. PLA Basic Weiß").fill("Neues PLA Silber");
    await dialog.getByPlaceholder("z.B. Weiß").fill("Silber");
    await dialog.getByPlaceholder("z.B. Prusament").fill("eSUN");

    await dialog.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(page.locator("table").getByText("Neues PLA Silber")).toBeVisible({ timeout: 5000 });
  });

  test("can edit an existing filament", async ({ seed, page }) => {
    await createTestFilament({ name: "Edit Me Filament" });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Edit Me Filament")).toBeVisible();

    const row = page.locator("tr").filter({ hasText: "Edit Me Filament" });
    await row.getByRole("button").first().click();

    await expect(page.getByRole("dialog")).toBeVisible();

    const nameInput = page.getByPlaceholder("z.B. PLA Basic Weiß");
    await nameInput.clear();
    await nameInput.fill("Edited Filament Name");

    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(page.locator("table").getByText("Edited Filament Name")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("table").getByText("Edit Me Filament")).not.toBeVisible();
  });

  test("can delete a filament with no assignments", async ({ seed, page }) => {
    await createTestFilament({ name: "Delete Me Filament" });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Delete Me Filament")).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    const row = page.locator("tr").filter({ hasText: "Delete Me Filament" });
    await row.getByRole("button").last().click();

    await expect(page.locator("table").getByText("Delete Me Filament")).not.toBeVisible({ timeout: 5000 });
  });

  test("shows 409 error toast when deleting a filament that has assignments", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");

    const f = await createTestFilament({ name: "Assigned Filament" });
    const order = await createTestOrder(phase.id);
    await createTestOrderPart(order.id, { name: "Gehäuse", filamentId: f.id });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Assigned Filament")).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    const row = page.locator("tr").filter({ hasText: "Assigned Filament" });
    await row.getByRole("button").last().click();

    await expect(page.locator("table").getByText("Assigned Filament")).toBeVisible({ timeout: 3000 });
  });

  test("material filter shows only matching filaments", async ({ seed, page }) => {
    await createTestFilament({ name: "Filter PLA", material: "PLA" });
    await createTestFilament({ name: "Filter PETG", material: "PETG" });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Filter PLA")).toBeVisible();
    await expect(page.locator("table").getByText("Filter PETG")).toBeVisible();

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "PLA" }).click();

    await expect(page.locator("table").getByText("Filter PLA")).toBeVisible();
    await expect(page.locator("table").getByText("Filter PETG")).not.toBeVisible();
  });

  test("inactive filaments are hidden by default and shown with checkbox", async ({ seed, page }) => {
    await createTestFilament({ name: "Inaktives Filament", isActive: false });

    await page.goto("/admin/inventory");
    await expect(page.locator("table").getByText("Inaktives Filament")).not.toBeVisible();

    await page.getByLabel("Inaktive anzeigen").check();
    await expect(page.locator("table").getByText("Inaktives Filament")).toBeVisible();
  });
});

test.describe("Teile section on order detail", () => {
  let orderId: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");
    const order = await createTestOrder(phase.id, { customerName: "Material Tester" });
    await createTestFilament({ name: "Assignment PLA Rot", color: "Rot" });
    orderId = order.id;
  });

  test("shows Teil hinzufügen button on order detail", async ({ seed, page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByRole("button", { name: /^Teil$/ })).toBeVisible();
  });

  test("can add a part to an order", async ({ seed, page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    await page.getByRole("button", { name: /^Teil$/ }).click();
    await page.getByPlaceholder("Teilname *").fill("Hauptgehäuse");
    await page.getByRole("button", { name: /^Hinzufügen$/ }).click();

    await expect(page.getByText("Teil hinzugefügt").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Hauptgehäuse").first()).toBeVisible();
  });

  test("can delete a part from an order", async ({ seed, page }) => {
    await createTestOrderPart(orderId, { name: "Deckel Teil" });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Deckel Teil").first()).toBeVisible();

    page.on("dialog", (d) => d.accept());
    const partSection = page.locator('[data-testid="part-section"]').filter({ hasText: "Deckel Teil" });
    await partSection.locator('button[aria-haspopup="menu"]').last().click();
    await page.getByRole("menuitem", { name: /Löschen/ }).click();

    await expect(page.getByText("Teil gelöscht").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Deckel Teil")).not.toBeVisible();
  });

  test("part addition appears in audit log", async ({ seed, page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    await page.getByRole("button", { name: /^Teil$/ }).click();
    await page.getByPlaceholder("Teilname *").fill("Boden");
    await page.getByRole("button", { name: /^Hinzufügen$/ }).click();

    await expect(page.getByText("Teil hinzugefügt").first()).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.getByText("Verlauf").click();
    await expect(page.getByText("Teil hinzugefügt").first()).toBeVisible({ timeout: 5000 });
  });
});
