import { test as base, type Browser, type BrowserContext } from "@playwright/test";
import { prismaTest, resetDb, seedDb } from "./db";

/**
 * Custom test fixture that automatically resets and seeds the test DB
 * before each test, and disconnects Prisma after all tests complete.
 *
 * Usage in spec files:
 *   import { test, expect } from "../fixtures/test-base";
 *
 * This replaces manual beforeEach(resetDb+seedDb) and afterEach cleanup.
 * The seed data (admin user, phases) is available via the `seed` fixture.
 */

type SeedData = Awaited<ReturnType<typeof seedDb>>;

export const test = base.extend<{ seed: SeedData }>({
  seed: async ({}, provide) => {
    await resetDb();
    const data = await seedDb();
    await provide(data);
  },
});

/**
 * Sign in as someone other than the seeded admin.
 *
 * Admin specs run with a stored ADMIN session (`storageState`), so testing any
 * other role needs a context that starts logged out. Callers must close the
 * returned context.
 *
 *   const { context, page } = await loginAs(browser, "schueler@example.com");
 *   ...
 *   await context.close();
 */
export async function loginAs(
  browser: Browser,
  email: string,
  password = "admin123",
): Promise<{ context: BrowserContext; page: import("@playwright/test").Page }> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/auth/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: /Anmelden/i }).click();
  await page.waitForURL("**/admin**");
  return { context, page };
}

export { expect } from "@playwright/test";
