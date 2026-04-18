import { test as base } from "@playwright/test";
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
  seed: async ({}, use) => {
    await resetDb();
    const data = await seedDb();
    await use(data);
  },
});

export { expect } from "@playwright/test";
