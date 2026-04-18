import { test as setup } from "@playwright/test";
import path from "path";
import { resetDb, seedDb } from "./fixtures/db";

const authFile = path.join(__dirname, ".auth/admin.json");

setup("reset db and authenticate admin", async ({ page }) => {
  setup.setTimeout(60000);

  // Reset and seed test DB
  await resetDb();
  await seedDb();

  // Authenticate as admin and save storage state
  await page.goto("/auth/signin");
  await page.getByLabel("E-Mail").fill("admin@3dprinting.local");
  await page.getByLabel("Passwort").fill("admin123");
  await page.getByRole("button", { name: /Anmelden/i }).click();

  // Wait for redirect to admin dashboard
  await page.waitForURL("**/admin**", { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
