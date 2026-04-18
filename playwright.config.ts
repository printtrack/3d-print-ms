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
    // Public tests (no auth)
    {
      name: "public",
      testMatch: "**/public/**/*.spec.ts",
      dependencies: ["setup"],
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
