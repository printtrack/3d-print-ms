import { test, expect } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { prismaTest, createTestCustomer } from "../fixtures/db";

// Which order types each channel accepts (Settings → Auftragsannahme).
// The Setting table is not truncated by resetDb() — restore the keys after each test.
const KEYS = [
  "orders_public_print_enabled",
  "orders_public_design_enabled",
  "orders_portal_print_enabled",
  "orders_portal_design_enabled",
  "orderform_field_ordertype_visible",
];

async function setSetting(key: string, value: string) {
  await prismaTest.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

test.afterEach(async () => {
  for (const key of KEYS) await setSetting(key, "");
});

const validOrder = {
  customerName: "Intake Tester",
  customerEmail: "intake@example.com",
  description: "A sufficiently long order description.",
};

async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test.describe("public channel", () => {
  test("offers both order types by default", async ({ seed, page }) => {
    void seed;
    await page.goto("/");
    await expect(page.locator("#order-form")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Nur Druck/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Design/i })).toBeVisible();
  });

  test("hides the type picker when only print is accepted", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_public_design_enabled", "false");

    await page.goto("/");
    await expect(page.locator("#order-form")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Nur Druck/i })).toHaveCount(0);
  });

  test("submits the single accepted type implicitly", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_public_print_enabled", "false");

    await page.goto("/");
    await page.getByLabel("Name *").fill("Design Kunde");
    await page.getByLabel("E-Mail *").fill("design@example.com");
    await page.getByLabel("Beschreibung *").fill("Bitte ein Gehäuse konstruieren.");
    await page.locator("#order-form").getByRole("button", { name: /Einreichen/i }).click();

    await expect(page.getByText(/Auftrag erfolgreich eingereicht/i)).toBeVisible({ timeout: 10000 });
    const order = await prismaTest.order.findFirst({ where: { customerEmail: "design@example.com" } });
    expect(order?.orderType).toBe("DESIGN");
  });

  // The whole point of the feature: the gate must not live in the form alone.
  test("rejects a disabled type posted directly to the API", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_public_design_enabled", "false");

    const res = await page.request.post("/api/orders", {
      data: { ...validOrder, orderType: "DESIGN" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/Designaufträge/i);
  });

  test("still accepts the enabled type", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_public_design_enabled", "false");

    const res = await page.request.post("/api/orders", {
      data: { ...validOrder, orderType: "PRINT_ONLY" },
    });
    expect(res.status()).toBe(201);
  });

  test("honours the legacy 'show order type' switch", async ({ seed, page }) => {
    void seed;
    // Installs that hid the picker forced PRINT_ONLY — that must survive the migration
    // to the new matrix, without any of the new keys being set.
    await setSetting("orderform_field_ordertype_visible", "false");

    const res = await page.request.post("/api/orders", {
      data: { ...validOrder, orderType: "DESIGN" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("public channel disabled", () => {
  test.beforeEach(async () => {
    await setSetting("orders_public_print_enabled", "false");
    await setSetting("orders_public_design_enabled", "false");
  });

  test("replaces the landing-page form with an account CTA", async ({ seed, page }) => {
    void seed;
    await page.goto("/");

    await expect(page.locator("#order-form form")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Aufträge nur mit Kundenkonto/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Zum Kundenportal/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Konto anlegen/i })).toBeVisible();
  });

  test("rejects anonymous orders at the API", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/orders", {
      data: { ...validOrder, orderType: "PRINT_ONLY" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/Kundenkonto/i);
  });

  test("still accepts orders from a signed-in customer", async ({ seed, page }) => {
    void seed;
    await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
    await loginAsCustomer(page, "kunde@example.com", "passwort123");

    await page.goto("/portal/orders/new");
    await page.getByLabel("Beschreibung *").fill("Auftrag trotz geschlossener Öffentlichkeit");
    await page.getByRole("button", { name: "Auftrag einreichen" }).click();

    await page.waitForURL(/\/portal\/orders\/(?!new$)[^/]+$/);
  });
});

test.describe("portal channel", () => {
  // `seed` must be destructured here too — it is what triggers the DB reset,
  // and it has to happen before the customer is created.
  test.beforeEach(async ({ seed }) => {
    void seed;
    await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  });

  test("design-only portal hides the picker and files the order as DESIGN", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_portal_print_enabled", "false");
    await loginAsCustomer(page, "kunde@example.com", "passwort123");

    await page.goto("/portal/orders/new");
    await expect(page.getByRole("radio", { name: /Nur Druck/i })).toHaveCount(0);

    await page.getByLabel("Beschreibung *").fill("Bitte ein Gehäuse konstruieren.");
    await page.getByRole("button", { name: "Auftrag einreichen" }).click();
    await page.waitForURL(/\/portal\/orders\/(?!new$)[^/]+$/);

    const order = await prismaTest.order.findFirst({ where: { customerEmail: "kunde@example.com" } });
    expect(order?.orderType).toBe("DESIGN");
  });

  test("rejects a disabled type posted directly by a signed-in customer", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_portal_design_enabled", "false");
    await loginAsCustomer(page, "kunde@example.com", "passwort123");

    const res = await page.request.post("/api/orders", {
      data: { ...validOrder, customerEmail: "kunde@example.com", orderType: "DESIGN" },
    });
    expect(res.status()).toBe(403);
  });

  test("hides the new-order CTA and blocks the page when the portal accepts nothing", async ({ seed, page }) => {
    void seed;
    await setSetting("orders_portal_print_enabled", "false");
    await setSetting("orders_portal_design_enabled", "false");
    await loginAsCustomer(page, "kunde@example.com", "passwort123");

    await expect(page.getByRole("link", { name: /Neuen Auftrag einreichen/i })).toHaveCount(0);

    await page.goto("/portal/orders/new");
    await page.waitForURL("/portal");
  });
});
