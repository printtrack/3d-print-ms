import { defineConfig, devices } from "@playwright/test";
import path from "path";
import * as dotenv from "dotenv";

// Load test env — makes DATABASE_URL_TEST available to the test process (db.ts)
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export const STORAGE_STATE = path.join(__dirname, "tests/.auth/admin.json");

const TEST_PORT = 3001;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "on-failure" }]],
  timeout: 45000,
  // Increase expect() assertion timeout from default 5s to 10s.
  // Turbopack compiles routes lazily; the first request to an unvisited
  // route can take >5s, causing toBeVisible() timeouts in the full suite.
  expect: { timeout: 10000 },
  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Setup: authenticate once before admin tests
    {
      name: "setup",
      testMatch: "**/global-setup.ts",
    },
    // Public tests (no auth) — higher expect timeout because the landing page
    // may be slow on first access due to Turbopack lazy compilation.
    {
      name: "public",
      testMatch: "**/public/**/*.spec.ts",
      dependencies: ["setup"],
      use: {
        actionTimeout: 15000,
      },
    },
    // Admin tests (uses saved auth state)
    {
      name: "admin",
      testMatch: "**/admin/**/*.spec.ts",
      dependencies: ["setup"],
      use: {
        storageState: STORAGE_STATE,
      },
    },
    // Portal tests (no pre-saved auth — logs in fresh via UI)
    {
      name: "portal",
      testMatch: "**/portal/**/*.spec.ts",
      dependencies: ["setup"],
    },
    // Tool scripts (screenshot generators etc.) — not part of regular suite
    {
      name: "tools",
      testMatch: "**/tools/**/*.spec.ts",
      dependencies: ["setup"],
      use: {
        storageState: STORAGE_STATE,
      },
    },
  ],
  webServer: {
    command: `next dev --port ${TEST_PORT}`,
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-secret-key-change-in-production-min-32-chars",
      AUTH_URL: TEST_BASE_URL,
      UPLOAD_DIR: process.env.UPLOAD_DIR ?? "public/uploads",
      NEXT_DIST_DIR: ".next-test",
      DISABLE_RATE_LIMIT: "true",
    },
  },
});
