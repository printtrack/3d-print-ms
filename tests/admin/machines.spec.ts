import { test, expect } from "../fixtures/test-base";
import { createTestMachine } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("shows empty state when no machines", async ({ seed, page }) => {
  await page.goto("/admin/machines");
  await expect(page.getByText("Noch keine Maschinen konfiguriert")).toBeVisible();
});

test("creates a new machine", async ({ seed, page }) => {
  await page.goto("/admin/machines");
  await page.getByRole("button", { name: /Maschine hinzufügen/i }).click();

  await page.getByLabel("Name *").fill("Prusa MK4");
  await page.locator('input[placeholder="X"]').fill("250");
  await page.locator('input[placeholder="Y"]').fill("210");
  await page.locator('input[placeholder="Z"]').fill("220");
  await page.getByLabel("Stundensatz").fill("2.50");

  await page.getByRole("button", { name: /^Speichern$/ }).click();

  await expect(page.getByText("Prusa MK4")).toBeVisible();
  await expect(page.getByText("250 × 210 × 220 mm")).toBeVisible();
  await expect(page.getByText("Maschine erstellt").first()).toBeVisible();
});

test("edits an existing machine", async ({ seed, page }) => {
  await createTestMachine({ name: "Test Drucker A" });
  await page.goto("/admin/machines");

  await page.getByText("Test Drucker A").waitFor();
  await page
    .locator('[data-testid="machine-row"]')
    .filter({ hasText: "Test Drucker A" })
    .getByRole("button")
    .nth(0)
    .click();

  await page.getByLabel("Name *").fill("Test Drucker B");
  await page.getByRole("button", { name: /^Speichern$/ }).click();

  await expect(page.getByText("Test Drucker B")).toBeVisible();
  await expect(page.getByText("Maschine aktualisiert").first()).toBeVisible();
});

test("deletes a machine without active jobs", async ({ seed, page }) => {
  await createTestMachine({ name: "Löschen Drucker" });
  await page.goto("/admin/machines");
  await page.getByText("Löschen Drucker").waitFor();

  page.on("dialog", (d) => d.accept());
  await page
    .locator('[data-testid="machine-row"]')
    .filter({ hasText: "Löschen Drucker" })
    .getByRole("button")
    .nth(1)
    .click();

  await expect(page.getByText("Löschen Drucker")).not.toBeVisible();
  await expect(page.getByText("Maschine gelöscht").first()).toBeVisible();
});
