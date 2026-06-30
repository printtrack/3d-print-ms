import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// The Setting table is NOT truncated by resetDb(), so module toggles would leak
// between tests. Every test restores all modules to enabled afterwards.
const MODULE_KEYS = [
  "module_quotes_enabled",
  "module_invoices_enabled",
  "module_jobs_enabled",
  "module_projects_enabled",
  "module_planning_enabled",
  "module_inventory_enabled",
  "module_knowledge_enabled",
  "module_portal_enabled",
  "module_tracking_enabled",
];

async function setModule(key: string, value: "true" | "false") {
  await prismaTest.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

test.afterEach(async () => {
  for (const key of MODULE_KEYS) await setModule(key, "true");
});

async function findPhase(name: string) {
  const phase = await prismaTest.orderPhase.findFirst({ where: { name } });
  if (!phase) throw new Error(`Phase ${name} not found`);
  return phase;
}

test("default (all modules on): order detail shows the quote editor", async ({ seed, page }) => {
  void seed;
  const phase = await findPhase("In Prüfung");
  const order = await createTestOrder(phase.id, { customerName: "Default On" });

  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByRole("button", { name: "Angebot erstellen" })).toBeVisible();
});

test("quotes disabled: editor is hidden and the API rejects creation", async ({ seed, page }) => {
  void seed;
  await setModule("module_quotes_enabled", "false");
  const phase = await findPhase("In Prüfung");
  const order = await createTestOrder(phase.id, { customerName: "Quotes Off" });

  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByRole("button", { name: "Angebot erstellen" })).toHaveCount(0);

  const res = await page.request.post(`/api/admin/orders/${order.id}/quotes`, {
    data: { items: [] },
  });
  expect(res.status()).toBe(403);
});

test("invoices disabled: the invoice API rejects creation", async ({ seed, page }) => {
  void seed;
  await setModule("module_invoices_enabled", "false");
  const phase = await findPhase("In Prüfung");
  const order = await createTestOrder(phase.id, { customerName: "Invoices Off" });

  const res = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: "whatever" },
  });
  expect(res.status()).toBe(403);
});

test("invoices depend on quotes: disabling quotes also blocks invoices", async ({ seed, page }) => {
  void seed;
  // invoices stays enabled, but quotes is off -> dependency forces invoices off
  await setModule("module_quotes_enabled", "false");
  const phase = await findPhase("In Prüfung");
  const order = await createTestOrder(phase.id, { customerName: "Dependency" });

  const res = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: "whatever" },
  });
  expect(res.status()).toBe(403);
});

test("knowledge disabled: nav link is gone and the route redirects", async ({ seed, page }) => {
  void seed;
  await setModule("module_knowledge_enabled", "false");

  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Wissensdatenbank" })).toHaveCount(0);

  await page.goto("/admin/knowledge");
  await expect(page).toHaveURL(/\/admin$/);
});
