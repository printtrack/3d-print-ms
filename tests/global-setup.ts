import { test as setup } from "@playwright/test";
import path from "path";
import { resetDb, seedDb } from "./fixtures/db";

const authFile = path.join(__dirname, ".auth/admin.json");

setup("reset db and authenticate admin", async ({ page }) => {
  setup.setTimeout(120000);

  // Reset and seed test DB
  await resetDb();
  await seedDb();

  // Warm up routes that Turbopack compiles lazily — prevents compilation-lag
  // timeouts in the first test that visits each route. Use "domcontentloaded"
  // (not "networkidle") because /admin/orders keeps an SSE connection open.
  for (const route of ["/", "/auth/signin", "/admin/orders"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
  }

  // Authenticate as admin and save storage state
  await page.goto("/auth/signin");
  await page.getByLabel("E-Mail").fill("admin@3dprinting.local");
  await page.getByLabel("Passwort").fill("admin123");
  await page.getByRole("button", { name: /Anmelden/i }).click();

  // Wait for redirect to admin dashboard
  await page.waitForURL("**/admin**", { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
