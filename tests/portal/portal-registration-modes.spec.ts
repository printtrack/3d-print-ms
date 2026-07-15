import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestCustomerInvite } from "../fixtures/db";

// Setting table is not truncated by resetDb() — restore the key after each test.
async function setMode(mode: "open" | "invite" | "closed") {
  await prismaTest.setting.upsert({
    where: { key: "portal_registration_mode" },
    update: { value: mode },
    create: { key: "portal_registration_mode", value: mode },
  });
}

test.afterEach(async () => {
  await setMode("open");
});

const newAccount = {
  name: "Neue Kundin",
  email: "neu@example.com",
  password: "passwort123",
};

async function fillRegistrationForm(page: import("@playwright/test").Page, email = newAccount.email) {
  await page.getByLabel("Name").fill(newAccount.name);
  const emailField = page.getByLabel("E-Mail");
  if (await emailField.isEditable()) await emailField.fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(newAccount.password);
  await page.getByLabel("Passwort bestätigen").fill(newAccount.password);
}

test.describe("open registration (default)", () => {
  test("anyone can create an account", async ({ seed, page }) => {
    void seed;
    await setMode("open");

    await page.goto("/portal/register");
    await fillRegistrationForm(page);
    await page.getByRole("button", { name: "Konto erstellen" }).click();

    await page.waitForURL("/portal");
    expect(await prismaTest.customer.findUnique({ where: { email: newAccount.email } })).not.toBeNull();
  });
});

test.describe("closed registration", () => {
  test.beforeEach(async () => setMode("closed"));

  test("shows a notice instead of the form", async ({ seed, page }) => {
    void seed;
    await page.goto("/portal/register");

    await expect(page.getByText(/Registrierung deaktiviert/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Konto erstellen" })).toHaveCount(0);
  });

  test("hides the register link on the sign-in page", async ({ seed, page }) => {
    void seed;
    await page.goto("/portal/signin");

    await expect(page.getByRole("link", { name: /Jetzt registrieren/i })).toHaveCount(0);
  });

  test("rejects a direct API registration", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/portal/auth/register", { data: newAccount });

    expect(res.status()).toBe(403);
    expect(await prismaTest.customer.findUnique({ where: { email: newAccount.email } })).toBeNull();
  });
});

test.describe("invite-only registration", () => {
  test.beforeEach(async () => setMode("invite"));

  test("shows a notice without an invite token", async ({ seed, page }) => {
    void seed;
    await page.goto("/portal/register");

    await expect(page.getByText(/Nur mit Einladung/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Konto erstellen" })).toHaveCount(0);
  });

  test("rejects a direct API registration without an invite", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/portal/auth/register", { data: newAccount });

    expect(res.status()).toBe(403);
    expect(await prismaTest.customer.findUnique({ where: { email: newAccount.email } })).toBeNull();
  });

  test("an unbound invite lets anyone register and is consumed", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite();

    await page.goto(`/portal/register?invite=${invite.token}`);
    await fillRegistrationForm(page);
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await page.waitForURL("/portal");

    const customer = await prismaTest.customer.findUnique({ where: { email: newAccount.email } });
    expect(customer).not.toBeNull();
    const used = await prismaTest.customerInvite.findUnique({ where: { token: invite.token } });
    expect(used?.usedAt).not.toBeNull();
    expect(used?.usedById).toBe(customer!.id);
  });

  test("a bound invite locks the email field and verifies the account", async ({ seed, page }) => {
    void seed;
    // Email verification is on: receiving the invite at that address is proof enough.
    await prismaTest.setting.upsert({
      where: { key: "customer_verification_mode" },
      update: { value: "email" },
      create: { key: "customer_verification_mode", value: "email" },
    });
    const invite = await createTestCustomerInvite({ email: newAccount.email });

    await page.goto(`/portal/register?invite=${invite.token}`);
    await expect(page.getByLabel("E-Mail")).toHaveValue(newAccount.email);
    await expect(page.getByLabel("E-Mail")).not.toBeEditable();

    await fillRegistrationForm(page);
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await page.waitForURL("/portal");

    const customer = await prismaTest.customer.findUnique({ where: { email: newAccount.email } });
    expect(customer?.emailVerifiedAt).not.toBeNull();

    await prismaTest.setting.update({
      where: { key: "customer_verification_mode" },
      data: { value: "off" },
    });
  });

  test("a bound invite cannot be used for another address", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite({ email: "eingeladen@example.com" });

    const res = await page.request.post("/api/portal/auth/register", {
      data: { ...newAccount, inviteToken: invite.token },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/andere E-Mail-Adresse/i);
    expect(await prismaTest.customer.findUnique({ where: { email: newAccount.email } })).toBeNull();
  });

  test("an expired invite is refused", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite({
      expiresAt: new Date(Date.now() - 60_000),
    });

    await page.goto(`/portal/register?invite=${invite.token}`);
    await expect(page.getByText(/abgelaufen/i)).toBeVisible();

    const res = await page.request.post("/api/portal/auth/register", {
      data: { ...newAccount, inviteToken: invite.token },
    });
    expect(res.status()).toBe(400);
  });

  test("an invite cannot be redeemed twice", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite();

    const first = await page.request.post("/api/portal/auth/register", {
      data: { ...newAccount, inviteToken: invite.token },
    });
    expect(first.status()).toBe(200);

    const second = await page.request.post("/api/portal/auth/register", {
      data: { ...newAccount, email: "zweite@example.com", inviteToken: invite.token },
    });
    expect(second.status()).toBe(400);
    expect(await prismaTest.customer.findUnique({ where: { email: "zweite@example.com" } })).toBeNull();
  });

  test("an unknown invite token is refused", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/portal/auth/register", {
      data: { ...newAccount, inviteToken: "gibtesnicht" },
    });
    expect(res.status()).toBe(400);
  });
});
