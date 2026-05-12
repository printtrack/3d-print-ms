import { test, expect } from "../fixtures/test-base";
import {
  createTestCustomer,
  createTestCustomerVerificationToken,
  prismaTest,
} from "../fixtures/db";

async function setVerificationMode(mode: "off" | "admin" | "email") {
  await prismaTest.setting.upsert({
    where: { key: "customer_verification_mode" },
    update: { value: mode },
    create: { key: "customer_verification_mode", value: mode },
  });
}

async function clearVerificationMode() {
  await prismaTest.setting.deleteMany({ where: { key: "customer_verification_mode" } });
}

async function signInAsCustomer(page: import("@playwright/test").Page, email: string, password = "password123") {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test.describe("Portal verification — admin mode", () => {
  test.afterEach(async () => { await clearVerificationMode(); });

  test("self-registered customer sees admin-mode banner without resend button", async ({ seed, page }) => {
    await setVerificationMode("admin");

    await page.goto("/portal/register");
    await page.getByLabel("Name").fill("Banner Tester");
    await page.getByLabel("E-Mail").fill("banner@example.com");
    await page.locator("#password").fill("passwort123");
    await page.locator("#confirm").fill("passwort123");
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await page.waitForURL("/portal");

    await expect(page.getByText("Konto noch nicht freigeschaltet").first()).toBeVisible();
    await expect(page.getByText("Das Team prüft Ihre Registrierung").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Erneut senden/ })).not.toBeVisible();
  });

  test("admin mode: /portal/orders/new redirects unverified customer back to /portal", async ({ seed, page }) => {
    await setVerificationMode("admin");
    await createTestCustomer({ email: "block@example.com", emailVerifiedAt: null });

    await signInAsCustomer(page, "block@example.com");
    await page.goto("/portal/orders/new");
    await expect(page).toHaveURL(/\/portal(\?|$)/);
    await expect(page.getByText("Konto noch nicht freigeschaltet").first()).toBeVisible();
  });

  test("admin mode: verified customer sees no banner", async ({ seed, page }) => {
    await setVerificationMode("admin");
    await createTestCustomer({ email: "verified@example.com", emailVerifiedAt: new Date() });

    await signInAsCustomer(page, "verified@example.com");
    await expect(page.getByText("Konto noch nicht freigeschaltet")).not.toBeVisible();
  });

  test("admin mode: unverified customer POST /api/orders returns 403", async ({ seed, page }) => {
    await setVerificationMode("admin");
    await createTestCustomer({ email: "blocked@example.com", emailVerifiedAt: null });

    await signInAsCustomer(page, "blocked@example.com");

    const res = await page.request.post("/api/orders", {
      data: {
        customerName: "Blocked",
        customerEmail: "blocked@example.com",
        description: "Test order that should be blocked by verification",
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/freigeschalten/);
  });
});

test.describe("Portal verification — email mode", () => {
  test.afterEach(async () => { await clearVerificationMode(); });

  test("email mode: register creates unverified customer + token", async ({ seed, page }) => {
    await setVerificationMode("email");

    await page.goto("/portal/register");
    await page.getByLabel("Name").fill("Email Tester");
    await page.getByLabel("E-Mail").fill("email-verify@example.com");
    await page.locator("#password").fill("passwort123");
    await page.locator("#confirm").fill("passwort123");
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await page.waitForURL("/portal");

    await expect(page.getByText("E-Mail-Adresse noch nicht bestätigt").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Erneut senden/ })).toBeVisible();

    const customer = await prismaTest.customer.findUnique({ where: { email: "email-verify@example.com" } });
    expect(customer!.emailVerifiedAt).toBeNull();
    const tokenCount = await prismaTest.customerEmailVerificationToken.count({ where: { customerId: customer!.id } });
    expect(tokenCount).toBe(1);
  });

  test("email mode: valid token verifies customer and redirects to /portal", async ({ seed, page }) => {
    await setVerificationMode("email");
    const customer = await createTestCustomer({ email: "tokentest@example.com", emailVerifiedAt: null });
    const tokenRecord = await createTestCustomerVerificationToken(customer.id);

    // Sign in first so /portal is accessible after the redirect
    await signInAsCustomer(page, "tokentest@example.com");

    await page.goto(`/api/portal/auth/verify/${tokenRecord.token}`);
    await expect(page).toHaveURL(/\/portal(\?.*verified.*|$)/);

    const updated = await prismaTest.customer.findUnique({ where: { id: customer.id } });
    expect(updated!.emailVerifiedAt).not.toBeNull();
    const remaining = await prismaTest.customerEmailVerificationToken.findUnique({ where: { token: tokenRecord.token } });
    expect(remaining).toBeNull();
  });

  test("email mode: expired token redirects to /portal/verify-error", async ({ seed, page }) => {
    await setVerificationMode("email");
    const customer = await createTestCustomer({ email: "expired@example.com", emailVerifiedAt: null });
    const tokenRecord = await createTestCustomerVerificationToken(customer.id, {
      expires: new Date(Date.now() - 1000),
    });

    await page.goto(`/api/portal/auth/verify/${tokenRecord.token}`);
    await expect(page).toHaveURL(/\/portal\/verify-error/);
    await expect(page.getByText("Bestätigungslink ungültig oder abgelaufen")).toBeVisible();
  });

  test("email mode: unknown token redirects to /portal/verify-error", async ({ seed, page }) => {
    await page.goto("/api/portal/auth/verify/totally-invalid-token-xyz");
    await expect(page).toHaveURL(/\/portal\/verify-error/);
    await expect(page.getByText("Bestätigungslink ungültig oder abgelaufen")).toBeVisible();
  });

  test("email mode: resend creates new token (old deleted)", async ({ seed, page }) => {
    await setVerificationMode("email");
    const customer = await createTestCustomer({ email: "resend@example.com", emailVerifiedAt: null });
    const oldToken = await createTestCustomerVerificationToken(customer.id);

    await signInAsCustomer(page, "resend@example.com");

    await page.getByRole("button", { name: /Erneut senden/ }).click();
    await expect(page.getByText("Bestätigungsmail wurde erneut gesendet").first()).toBeVisible({ timeout: 5000 });

    const oldTokenExists = await prismaTest.customerEmailVerificationToken.findUnique({ where: { token: oldToken.token } });
    expect(oldTokenExists).toBeNull();
    const newCount = await prismaTest.customerEmailVerificationToken.count({ where: { customerId: customer.id } });
    expect(newCount).toBe(1);
  });
});

test.describe("Portal verification — mode off (default)", () => {
  test.afterEach(async () => { await clearVerificationMode(); });

  test("mode off: registration → no banner, customer immediately verified", async ({ seed, page }) => {
    await setVerificationMode("off");

    await page.goto("/portal/register");
    await page.getByLabel("Name").fill("Sofort Tester");
    await page.getByLabel("E-Mail").fill("sofort@example.com");
    await page.locator("#password").fill("passwort123");
    await page.locator("#confirm").fill("passwort123");
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await page.waitForURL("/portal");

    await expect(page.getByText("Konto noch nicht freigeschaltet")).not.toBeVisible();
    const customer = await prismaTest.customer.findUnique({ where: { email: "sofort@example.com" } });
    expect(customer!.emailVerifiedAt).not.toBeNull();
  });
});
