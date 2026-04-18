import { test, expect } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { createTestCustomer } from "../fixtures/db";

async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test("shows pre-filled name and email read-only", async ({ seed, page }) => {
  await createTestCustomer({
    name: "Max Mustermann",
    email: "max@example.com",
    password: "passwort123",
  });
  await loginAsCustomer(page, "max@example.com", "passwort123");
  await page.goto("/portal/orders/new");

  // Name and email appear in the card description
  await expect(page.getByText(/Max Mustermann.*max@example\.com/)).toBeVisible();
  // Name and email are not editable inputs — just displayed as text
  await expect(page.locator('input[name="customerName"]')).toHaveCount(0);
  await expect(page.locator('input[name="customerEmail"]')).toHaveCount(0);
});

test("submits order and redirects to order detail", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto("/portal/orders/new");

  await page.getByLabel("Beschreibung *").fill("Mein Portal-Testauftrag");
  await page.getByRole("button", { name: "Auftrag einreichen" }).click();

  // Should redirect to /portal/orders/[id]
  await page.waitForURL(/\/portal\/orders\/[^/]+$/);
  await expect(page.getByText("Mein Portal-Testauftrag")).toBeVisible();
});

test("order appears in dashboard after submission", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto("/portal/orders/new");

  await page.getByLabel("Beschreibung *").fill("Dashboard-Sichtbarkeitstest");
  await page.getByRole("button", { name: "Auftrag einreichen" }).click();
  await page.waitForURL(/\/portal\/orders\/[^/]+$/);

  await page.goto("/portal");
  await expect(page.getByText("Dashboard-Sichtbarkeitstest")).toBeVisible();
});

test("dashboard has link to new order form", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  await loginAsCustomer(page, "kunde@example.com", "passwort123");

  const link = page.getByRole("link", { name: "Neuen Auftrag einreichen" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/portal/orders/new");
});

test("empty state links to portal order form", async ({ seed, page }) => {
  await createTestCustomer({ email: "neu@example.com", password: "passwort123" });
  await loginAsCustomer(page, "neu@example.com", "passwort123");

  const link = page.getByRole("link", { name: /Jetzt Auftrag einreichen/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/portal/orders/new");
});

test("unauthenticated access redirects to signin", async ({ seed, page }) => {
  await page.goto("/portal/orders/new");
  await expect(page).toHaveURL(/\/portal\/signin/);
});
