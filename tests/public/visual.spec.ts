import { test, expect } from "../fixtures/test-base";

// Visual regression spec for stable static pages.
// Baselines live in tests/public/visual.spec.ts-snapshots/.
// Regenerate with: npx playwright test tests/public/visual.spec.ts --update-snapshots
//
// Scope: pages that have zero dynamic content (no timestamps, no user data, no lists
// that depend on DB state beyond default seed). Do NOT add kanban/dashboards here —
// those are tested by functional specs, and their layouts change often.

test.use({ storageState: { cookies: [], origins: [] } });

const SCREENSHOT_OPTIONS = {
  fullPage: true,
  // Tolerate minor font antialiasing differences across OS/browser updates.
  maxDiffPixelRatio: 0.02,
  // Disable CSS animations so we get a deterministic frame.
  animations: "disabled" as const,
} satisfies Parameters<ReturnType<typeof expect>["toHaveScreenshot"]>[1];

test.describe("Visual regression — static public pages", () => {
  test("landing page", async ({ seed, page }) => {
    await page.goto("/");
    // Wait for hero background + form to settle
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("landing.png", SCREENSHOT_OPTIONS);
  });

  test("sign-in page", async ({ seed, page }) => {
    await page.goto("/auth/signin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("signin.png", SCREENSHOT_OPTIONS);
  });

  test("reset password request page", async ({ seed, page }) => {
    await page.goto("/auth/reset-password");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("reset-password.png", SCREENSHOT_OPTIONS);
  });

  test("impressum", async ({ seed, page }) => {
    await page.goto("/impressum");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("impressum.png", SCREENSHOT_OPTIONS);
  });

  test("datenschutz", async ({ seed, page }) => {
    await page.goto("/datenschutz");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("datenschutz.png", SCREENSHOT_OPTIONS);
  });

  test("portal sign-in", async ({ seed, page }) => {
    await page.goto("/portal/signin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("portal-signin.png", SCREENSHOT_OPTIONS);
  });

  test("portal register", async ({ seed, page }) => {
    await page.goto("/portal/register");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("portal-register.png", SCREENSHOT_OPTIONS);
  });
});
