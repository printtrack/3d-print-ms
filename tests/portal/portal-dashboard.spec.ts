import { test, expect } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { createTestCustomer, createTestOrder } from "../fixtures/db";

async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test("shows Meine Aufträge heading after login", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  await loginAsCustomer(page, "kunde@example.com", "passwort123");

  await expect(page.getByRole("heading", { name: "Meine Aufträge" })).toBeVisible();
});

test("shows empty state when no orders", async ({ seed, page }) => {
  await createTestCustomer({ email: "neu@example.com", password: "passwort123" });
  await loginAsCustomer(page, "neu@example.com", "passwort123");

  await expect(page.getByText("Noch keine Aufträge")).toBeVisible();
  await expect(page.getByRole("link", { name: /Jetzt Auftrag einreichen/ })).toBeVisible();
});

test("shows order card with phase badge", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  await createTestOrder(seed.phases[0].id, {
    customerEmail: customer.email,
    description: "Mein Testauftrag",
  });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");

  await expect(page.getByText("Mein Testauftrag")).toBeVisible();
  await expect(page.getByText("Eingegangen")).toBeVisible();
  await expect(page.getByRole("link", { name: "Auftrag ansehen" })).toBeVisible();
});

test("does not show orders from other customers", async ({ seed, page }) => {
  const customer1 = await createTestCustomer({ email: "kunde1@example.com", password: "passwort123" });
  await createTestCustomer({ email: "kunde2@example.com", password: "passwort123" });

  await createTestOrder(seed.phases[0].id, {
    customerEmail: "kunde2@example.com",
    description: "Auftrag von Kunde 2",
  });
  await createTestOrder(seed.phases[0].id, {
    customerEmail: customer1.email,
    description: "Mein eigener Auftrag",
  });

  await loginAsCustomer(page, "kunde1@example.com", "passwort123");

  await expect(page.getByText("Mein eigener Auftrag")).toBeVisible();
  await expect(page.getByText("Auftrag von Kunde 2")).not.toBeVisible();
});

test("unauthenticated access redirects to signin", async ({ seed, page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/signin/);
});
