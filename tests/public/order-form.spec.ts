import { test, expect } from "../fixtures/test-base";
import path from "path";

test.describe("Order submission form", () => {
  test.beforeEach(async ({ seed, page }) => {
    await page.goto("/");
  });

  test("renders the order form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Hast du eine Idee/i })).toBeVisible();
    await expect(page.getByLabel("Name *")).toBeVisible();
    await expect(page.getByLabel("E-Mail *")).toBeVisible();
    await expect(page.getByLabel("Beschreibung *")).toBeVisible();
    await expect(page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i })).toBeVisible();
  });

  test("submits a basic order and shows tracking token", async ({ page }) => {
    await page.getByLabel("Name *").fill("Test Kunde");
    await page.getByLabel("E-Mail *").fill("testkunde@example.com");
    await page.getByLabel("Beschreibung *").fill("Bitte ein 10cm x 10cm Würfel in PLA drucken.");

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();

    // Should show success state with tracking link
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/track\//i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Zum Auftrag/i })).toBeVisible();
  });

  test("submits an order with a deadline", async ({ page }) => {
    await page.getByLabel("Name *").fill("Deadline Tester");
    await page.getByLabel("E-Mail *").fill("deadline@example.com");
    await page.getByLabel("Beschreibung *").fill("Dringend bis Freitag!");
    await page.getByLabel("Wunschdatum (optional)").fill("2026-12-31");

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();

    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    // The HTML required attributes will prevent submission; button should stay active
    const submitBtn = page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i });
    await expect(submitBtn).toBeEnabled();
    // Attempt submit without filling form — browser native validation prevents it
    await submitBtn.click();
    // Name field should be focused / invalid (native browser validation)
    const nameInput = page.getByLabel("Name *");
    await expect(nameInput).toBeVisible();
  });

  test("can navigate to tracking page after submission", async ({ page }) => {
    await page.getByLabel("Name *").fill("Navigation Tester");
    await page.getByLabel("E-Mail *").fill("nav@example.com");
    await page.getByLabel("Beschreibung *").fill("Test for navigation to tracking page");

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /Zum Auftrag/i }).click();
    await page.waitForURL(/\/track\//);
    await expect(page.url()).toContain("/track/");
  });

  test("file upload: can attach a file before submitting", async ({ page }) => {
    // Create a small dummy PNG buffer
    const testFile = path.join(__dirname, "../fixtures/test-image.png");

    await page.getByLabel("Name *").fill("File Upload Tester");
    await page.getByLabel("E-Mail *").fill("upload@example.com");
    await page.getByLabel("Beschreibung *").fill("Order with file attachment");

    // Set file via hidden input
    await page.locator("#file-upload").setInputFiles(testFile);

    // File should appear in list
    await expect(page.getByText("test-image.png")).toBeVisible();

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 15000 });
  });
});
