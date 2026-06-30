import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

// Setting table is not truncated by resetDb() — restore order-form keys after each test.
const KEYS = [
  "orderform_field_deadline_visible",
  "orderform_field_deadline_required",
  "orderform_field_ordertype_visible",
  "orderform_accepted_formats",
  "orderform_max_file_mb",
  "orderform_max_files",
  "orderform_consent_required",
];

async function setSetting(key: string, value: string) {
  await prismaTest.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

test.afterEach(async () => {
  for (const key of KEYS) await setSetting(key, "");
});

const validOrder = {
  customerName: "Config Tester",
  customerEmail: "config@example.com",
  description: "A sufficiently long order description.",
  orderType: "PRINT_ONLY" as const,
};

test("hiding the deadline field removes it from the public form", async ({ seed, page }) => {
  void seed;
  await setSetting("orderform_field_deadline_visible", "false");

  await page.goto("/");
  await expect(page.locator("#order-form #deadline")).toHaveCount(0);
});

test("a required deadline is enforced server-side", async ({ seed, page }) => {
  void seed;
  await setSetting("orderform_field_deadline_visible", "true");
  await setSetting("orderform_field_deadline_required", "true");

  const res = await page.request.post("/api/orders", { data: validOrder });
  expect(res.status()).toBe(400);
});

test("a required consent is enforced server-side", async ({ seed, page }) => {
  void seed;
  await setSetting("orderform_consent_required", "true");

  const res = await page.request.post("/api/orders", { data: validOrder });
  expect(res.status()).toBe(400);

  const ok = await page.request.post("/api/orders", { data: { ...validOrder, consentAccepted: true } });
  expect(ok.status()).toBe(201);
});

test("disallowed file formats are rejected on upload", async ({ seed, page }) => {
  void seed;
  const orderRes = await page.request.post("/api/orders", { data: validOrder });
  expect(orderRes.status()).toBe(201);
  const { orderId } = await orderRes.json();

  // Only STL is allowed now — a PNG must be skipped (not saved).
  await setSetting("orderform_accepted_formats", ".stl");

  const res = await page.request.post("/api/uploads", {
    multipart: {
      orderId,
      files: { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.files).toHaveLength(0);
});
