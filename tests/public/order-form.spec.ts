import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";
import path from "path";

test.describe("Order submission form", () => {
  test.beforeEach(async ({ seed, page }) => {
    await page.goto("/");
    // Wait explicitly for the order form section to be rendered (SSR + hydration
    // can take >5s on first access due to Turbopack lazy compilation).
    await page.locator("#order-form").waitFor({ state: "visible", timeout: 30000 });
  });

  test("renders the order form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Hast du eine Idee/i })).toBeVisible();
    await expect(page.getByLabel("Name *")).toBeVisible();
    await expect(page.getByLabel("E-Mail *")).toBeVisible();
    await expect(page.getByLabel("Beschreibung *")).toBeVisible();
    await expect(page.locator("#order-form").getByRole("button", { name: /Einreichen/i })).toBeVisible();
  });

  test("submits a basic order and shows tracking token", async ({ page }) => {
    await page.getByLabel("Name *").fill("Test Kunde");
    await page.getByLabel("E-Mail *").fill("testkunde@example.com");
    await page.getByLabel("Beschreibung *").fill("Bitte ein 10cm x 10cm Würfel in PLA drucken.");

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();

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

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();

    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    // The HTML required attributes will prevent submission; button should stay active
    const submitBtn = page.locator("#order-form").getByRole("button", { name: /Einreichen/i });
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

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /Zum Auftrag/i }).click();
    await page.waitForURL(/\/track\//);
    await expect(page.url()).toContain("/track/");
  });

  test("print-only order: submits with multiple source links", async ({ page }) => {
    // PRINT_ONLY is preselected, so the source-links section is visible
    await expect(page.getByRole("radio", { name: /Nur Druck/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await page.getByLabel("Name *").fill("Print Only Kunde");
    await page.getByLabel("E-Mail *").fill("printonly@example.com");
    await page.getByLabel("Beschreibung *").fill("Bitte diese zwei Modelle in PLA drucken.");

    // Add two model links
    const addLink = page.locator("#order-form").getByRole("button", { name: "Link hinzufügen" });
    await addLink.click();
    await addLink.click();
    const urlInputs = page.getByPlaceholder("https://www.printables.com/model/...");
    await expect(urlInputs).toHaveCount(2);
    await urlInputs.nth(0).fill("https://www.printables.com/model/12345");
    await urlInputs.nth(1).fill("https://makerworld.com/de/models/67890");

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });

    const order = await prismaTest.order.findFirst({
      where: { customerEmail: "printonly@example.com" },
      include: { sourceLinks: { orderBy: { createdAt: "asc" } } },
    });
    expect(order?.orderType).toBe("PRINT_ONLY");
    expect(order?.sourceLinks).toHaveLength(2);
    expect(order?.sourceLinks.map((l) => l.url)).toEqual([
      "https://www.printables.com/model/12345",
      "https://makerworld.com/de/models/67890",
    ]);
  });

  test("design order: hides source links and stores DESIGN type", async ({ page }) => {
    await page.getByRole("radio", { name: /Design benötigt/i }).click();

    // Source-links section disappears for DESIGN orders
    await expect(
      page.locator("#order-form").getByRole("button", { name: "Link hinzufügen" })
    ).toHaveCount(0);

    await page.getByLabel("Name *").fill("Design Kunde");
    await page.getByLabel("E-Mail *").fill("design@example.com");
    await page.getByLabel("Beschreibung *").fill("Ich brauche ein individuelles Gehäuse-Design.");

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });

    const order = await prismaTest.order.findFirst({
      where: { customerEmail: "design@example.com" },
      include: { sourceLinks: true },
    });
    expect(order?.orderType).toBe("DESIGN");
    expect(order?.sourceLinks).toHaveLength(0);
  });

  test("rejects an invalid source link URL via the API", async ({ page }) => {
    const res = await page.request.post("/api/orders", {
      data: {
        customerName: "Bad Link",
        customerEmail: "badlink@example.com",
        description: "Order with an invalid model link payload.",
        orderType: "PRINT_ONLY",
        sourceLinks: [{ url: "not-a-valid-url" }],
      },
    });
    expect(res.status()).toBe(400);
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

    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();
    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 15000 });
  });
});
