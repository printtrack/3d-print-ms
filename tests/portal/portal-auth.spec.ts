import { test, expect } from "../fixtures/test-base";
import { createTestCustomer } from "../fixtures/db";

test("registers a new account and redirects to portal", async ({ seed, page }) => {
  await page.goto("/portal/register");

  await page.getByLabel("Name").fill("Max Mustermann");
  await page.getByLabel("E-Mail").fill("neu@example.com");
  // Use the first "Passwort" label (the password field, not confirm)
  await page.locator("#password").fill("passwort123");
  await page.locator("#confirm").fill("passwort123");
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await page.waitForURL("/portal");
  await expect(page.getByRole("heading", { name: "Meine Aufträge" })).toBeVisible();
});

test("shows error on duplicate email registration", async ({ seed, page }) => {
  await createTestCustomer({ email: "existing@example.com" });

  await page.goto("/portal/register");
  await page.getByLabel("Name").fill("Zweiter User");
  await page.getByLabel("E-Mail").fill("existing@example.com");
  await page.locator("#password").fill("passwort123");
  await page.locator("#confirm").fill("passwort123");
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByText("E-Mail-Adresse bereits registriert").first()).toBeVisible();
});

test("signs in with valid credentials", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });

  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill("kunde@example.com");
  await page.getByLabel("Passwort").fill("passwort123");
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();

  await page.waitForURL("/portal");
  await expect(page.getByRole("heading", { name: "Meine Aufträge" })).toBeVisible();
});

test("shows error on invalid credentials", async ({ seed, page }) => {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill("falsch@example.com");
  await page.getByLabel("Passwort").fill("wrongpass");
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();

  await expect(page.getByText("Ungültige E-Mail oder Passwort").first()).toBeVisible();
});

test("signs out and redirects to signin", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });

  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill("kunde@example.com");
  await page.getByLabel("Passwort").fill("passwort123");
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");

  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL("/portal/signin");
});

test("password reset request always succeeds (no enumeration)", async ({ seed, page }) => {
  await page.goto("/portal/reset-password");
  await page.getByLabel("E-Mail").fill("irgendjemand@example.com");
  await page.getByRole("button", { name: "Reset-Link senden" }).click();

  await expect(
    page.getByText("Falls ein Konto mit")
  ).toBeVisible();
});
