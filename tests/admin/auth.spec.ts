import { test, expect } from "../fixtures/test-base";

// These tests don't use saved auth state — they test the login flow itself
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("redirects unauthenticated users from /admin to signin", async ({ seed, page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/auth\/signin/);
    await expect(page.getByRole("heading", { name: /3D Print CMS/i })).toBeVisible();
  });

  test("shows login form", async ({ seed, page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByLabel("E-Mail")).toBeVisible();
    await expect(page.getByLabel("Passwort")).toBeVisible();
    await expect(page.getByRole("button", { name: /Anmelden/i })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ seed, page }) => {
    await page.goto("/auth/signin");
    await page.getByLabel("E-Mail").fill("wrong@example.com");
    await page.getByLabel("Passwort").fill("wrongpassword");
    await page.getByRole("button", { name: /Anmelden/i }).click();

    await expect(page.getByText(/Ungültige E-Mail oder Passwort/i)).toBeVisible({ timeout: 5000 });
  });

  test("redirects to /admin after successful login", async ({ seed, page }) => {
    await page.goto("/auth/signin");
    await page.getByLabel("E-Mail").fill("admin@3dprinting.local");
    await page.getByLabel("Passwort").fill("admin123");
    await page.getByRole("button", { name: /Anmelden/i }).click();

    await page.waitForURL("**/admin**");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
  });
});
