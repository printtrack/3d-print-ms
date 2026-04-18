import { test, expect } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { createTestCustomer, createTestCreditTransaction } from "../fixtures/db";

async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test("shows Filamentguthaben banner with zero balance", async ({ seed, page }) => {
  await createTestCustomer({ email: "zero@example.com", password: "passwort123" });
  await loginAsCustomer(page, "zero@example.com", "passwort123");

  await expect(page.getByText("Filamentguthaben")).toBeVisible();
  await expect(page.getByText("Kein Guthaben verfügbar")).toBeVisible();
});

test("shows correct balance when customer has credits", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "rich@example.com", password: "passwort123" });
  await createTestCreditTransaction(customer.id, 450, "Guthaben-Kauf");

  await loginAsCustomer(page, "rich@example.com", "passwort123");

  await expect(page.getByText("Filamentguthaben")).toBeVisible();
  await expect(page.getByText("450 g")).toBeVisible();
});

test("can toggle transaction history", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "hist@example.com", password: "passwort123" });
  await createTestCreditTransaction(customer.id, 200, "Einkauf Guthaben");

  await loginAsCustomer(page, "hist@example.com", "passwort123");

  // History is hidden by default
  await expect(page.getByText("Einkauf Guthaben")).not.toBeVisible();

  // Click "Verlauf anzeigen"
  await page.getByRole("button", { name: /Verlauf anzeigen/ }).click();

  await expect(page.getByText("Einkauf Guthaben")).toBeVisible();
  await expect(page.getByText("+200 g")).toBeVisible();

  // Can collapse again
  await page.getByRole("button", { name: /Verlauf ausblenden/ }).click();
  await expect(page.getByText("Einkauf Guthaben")).not.toBeVisible();
});

test("no history toggle when no transactions", async ({ seed, page }) => {
  await createTestCustomer({ email: "notrans@example.com", password: "passwort123" });
  await loginAsCustomer(page, "notrans@example.com", "passwort123");

  // No toggle button when there are no transactions
  await expect(page.getByRole("button", { name: /Verlauf/ })).not.toBeVisible();
});
