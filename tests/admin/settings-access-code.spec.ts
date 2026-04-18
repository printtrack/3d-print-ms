import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

const TEST_CODE = "testcode123";
const FIXTURE_EMAIL = "accesscode@example.com";

async function enableAccessCode() {
  await prismaTest.setting.upsert({
    where: { key: "access_code_enabled" },
    update: { value: "true" },
    create: { key: "access_code_enabled", value: "true" },
  });
  await prismaTest.setting.upsert({
    where: { key: "access_code" },
    update: { value: TEST_CODE },
    create: { key: "access_code", value: TEST_CODE },
  });
}

async function disableAccessCode() {
  await prismaTest.setting.upsert({
    where: { key: "access_code_enabled" },
    update: { value: "false" },
    create: { key: "access_code_enabled", value: "false" },
  });
}

test.describe("Access code gate (enabled)", () => {
  test.beforeEach(async ({ seed }) => {
    await enableAccessCode();
  });

  test("shows access code field when enabled", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#accessCode")).toBeVisible({ timeout: 10000 });
  });

  test("rejects submission with wrong access code", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name *").fill("Test Kunde");
    await page.getByLabel("E-Mail *").fill(FIXTURE_EMAIL);
    await page.getByLabel("Beschreibung *").fill("Bitte ein 10cm Würfel drucken.");
    await page.locator("#accessCode").fill("falschercode");

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();

    await expect(page.getByText(/Ungültiger Zugangscode/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Auftrag erfolgreich/i)).not.toBeVisible();
  });

  test("accepts submission with correct access code", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name *").fill("Test Kunde");
    await page.getByLabel("E-Mail *").fill(FIXTURE_EMAIL);
    await page.getByLabel("Beschreibung *").fill("Bitte ein 10cm Würfel drucken.");
    await page.locator("#accessCode").fill(TEST_CODE);

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();

    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Access code gate (disabled)", () => {
  test.beforeEach(async ({ seed }) => {
    await disableAccessCode();
  });

  test("hides access code field when disabled", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#accessCode")).not.toBeVisible();
  });

  test("accepts submission without access code when disabled", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name *").fill("Test Kunde");
    await page.getByLabel("E-Mail *").fill(FIXTURE_EMAIL);
    await page.getByLabel("Beschreibung *").fill("Bitte ein 10cm Würfel drucken.");

    await page.locator("#order-form").getByRole("button", { name: /Auftrag einreichen/i }).click();

    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
  });
});
