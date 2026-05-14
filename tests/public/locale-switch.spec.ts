import { test, expect } from "../fixtures/test-base";

test.describe("Locale switch — anonymous visitor", () => {
  test("landing page starts in German by default", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Deine Idee/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Switch to English/i })).toBeVisible();
  });

  test("switches to English on landing page and persists after reload", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");

    await page.getByRole("button", { name: /Switch to English/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Your idea/i })).toBeVisible();
    await expect(page.getByText("Start print order").first()).toBeVisible();

    // Persist after reload
    await page.reload();
    await expect(page.getByRole("heading", { name: /Your idea/i })).toBeVisible();
  });

  test("switches back to German after toggling twice", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");

    await page.getByRole("button", { name: /Switch to English/i }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Zu Deutsch wechseln/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Deine Idee/i })).toBeVisible();
  });

  test("locale persists across navigation to auth page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");

    await page.getByRole("button", { name: /Switch to English/i }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByText("Enter your credentials")).toBeVisible();
  });
});
