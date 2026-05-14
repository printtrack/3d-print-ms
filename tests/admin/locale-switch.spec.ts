import { test, expect } from "../fixtures/test-base";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Locale switch — admin user", () => {
  test("admin dashboard starts in German (default)", async ({ seed, page }) => {
    void seed;
    await page.context().clearCookies();
    await page.goto("/auth/signin");

    await page.getByLabel("E-Mail").fill("admin@3dprinting.local");
    await page.getByLabel("Passwort").fill("admin123");
    await page.getByRole("button", { name: /Anmelden/i }).click();
    await page.waitForURL("**/admin");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Übersicht über laufende Aufträge")).toBeVisible();
    await expect(page.getByText("Aufträge & Produktion", { exact: false })).toBeVisible();
  });

  test("admin sidebar switches to English and back", async ({ seed, page }) => {
    void seed;
    // Start with admin session (storageState) — locale cookie is already set from previous session
    // Ensure DE locale
    await page.context().addCookies([
      { name: "locale", value: "de", domain: "localhost", path: "/" },
    ]);
    await page.goto("/admin");

    await expect(page.getByText("Aufträge & Produktion", { exact: false })).toBeVisible();

    // Switch to English via the sidebar switcher
    await page.getByRole("button", { name: /Switch to English/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Orders & Production", { exact: false })).toBeVisible();
    await expect(page.getByText("Overview of ongoing orders and activities")).toBeVisible();

    // Switch back to German
    await page.getByRole("button", { name: /Zu Deutsch wechseln/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Aufträge & Produktion", { exact: false })).toBeVisible();
  });
});
