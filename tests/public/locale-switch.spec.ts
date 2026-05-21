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
    await page.waitForLoadState("load");

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
    await page.waitForLoadState("load");
    await page.getByRole("button", { name: /Zu Deutsch wechseln/i }).click();
    await page.waitForLoadState("load");

    await expect(page.getByRole("heading", { name: /Deine Idee/i })).toBeVisible();
  });

  test("locale persists across navigation to auth page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");

    await page.getByRole("button", { name: /Switch to English/i }).click();
    await page.waitForLoadState("load");

    // Verify the locale switch completed on the current page before navigating.
    // router.refresh() is not a full page reload, so we need this confirmation.
    await expect(page.getByRole("heading", { name: /Your idea/i })).toBeVisible({ timeout: 10000 });

    await page.goto("/auth/signin");
    // CardTitle is a div, not a heading — match by text content instead
    await expect(page.getByText("Sign in").first()).toBeVisible();
    await expect(page.getByText("Enter your credentials")).toBeVisible();
  });
});
