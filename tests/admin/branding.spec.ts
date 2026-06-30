import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// Setting table is not truncated by resetDb() — restore branding keys after each test.
const KEYS = ["brand_accent_color", "billing_logo_url", "brand_favicon_url"];

async function setSetting(key: string, value: string) {
  await prismaTest.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

test.afterEach(async () => {
  for (const key of KEYS) await setSetting(key, "");
});

async function rootAccent(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--brand-accent").trim(),
  );
}

test("custom accent color is injected app-wide", async ({ seed, page }) => {
  void seed;
  await setSetting("brand_accent_color", "#2563eb");

  await page.goto("/admin");
  expect(await rootAccent(page)).toContain("#2563eb");
});

test("invalid accent color is rejected and falls back to the default", async ({ seed, page }) => {
  void seed;
  // Capture the default accent (no override injected) as a baseline.
  await setSetting("brand_accent_color", "");
  await page.goto("/admin");
  const baseline = await rootAccent(page);

  // A value that tries to break out of the CSS declaration must be ignored,
  // leaving the accent identical to the default.
  await setSetting("brand_accent_color", "red;}body{display:none}");
  await page.goto("/admin");
  const accent = await rootAccent(page);

  expect(accent).toBe(baseline);
  expect(accent).not.toContain("display");
});

test("uploaded logo replaces the printer mark in the sidebar", async ({ seed, page }) => {
  void seed;
  await setSetting("billing_logo_url", "/uploads/branding/logo.png");

  await page.goto("/admin");
  const logo = page.locator("aside img").first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /logo\.png/);
});
