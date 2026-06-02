// Screenshot generator for the wiki — not part of the regular E2E suite.
// Run with: npm run wiki:screenshots
// Requires the test server to be running (playwright starts it automatically).
// Output: public/wiki-screenshots/<slug>.png

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

const WIKI_DE_DIR = path.join(process.cwd(), "docs/wiki/de/admin");
const OUTPUT_DIR = path.join(process.cwd(), "public/wiki-screenshots");

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return (yaml.load(match[1]) as Record<string, unknown>) ?? {};
}

function getPagedRoutes(): { slug: string; route: string }[] {
  const files = fs.readdirSync(WIKI_DE_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const result: { slug: string; route: string }[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(WIKI_DE_DIR, file), "utf-8");
    const data = parseFrontmatter(content);
    if (data.route) {
      result.push({ slug: file.replace(/\.md$/, ""), route: data.route as string });
    }
  }
  return result;
}

const routes = getPagedRoutes();

for (const { slug, route } of routes) {
  test(`screenshot: ${slug} (${route})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    // Settings tabs with more content need a bit longer to settle
    const waitMs = route.includes("settings") ? 1200 : 800;
    await page.waitForTimeout(waitMs);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${slug}.png`),
      fullPage: false,
    });
  });
}

// ─── Seeded billing screenshots ──────────────────────────────────
// The billing workflow (quote + invoice cards) lives inside the order
// detail page and needs real data to render. We seed a self-contained
// order via prismaTest, screenshot it, and clean up prior runs by email.

const BILLING_ITEMS = [
  { description: "Filament PETG (Gehäuse-Unterteil)", quantity: 1, unitPriceCents: 1200, category: "FILAMENT" as const, source: "ACTUAL" as const },
  { description: "Filament PETG (Deckel + Halter)", quantity: 1, unitPriceCents: 800, category: "FILAMENT" as const, source: "ACTUAL" as const },
  { description: "Nachbearbeitung & Montage", quantity: 1, unitPriceCents: 2000, category: "POST_PROCESSING" as const, source: "FIXED" as const },
];
const BILLING_NET = BILLING_ITEMS.reduce((s, it) => s + it.quantity * it.unitPriceCents, 0); // 4000
const BILLING_TAX = Math.round(BILLING_NET * 0.19); // 760
const BILLING_TOTAL = BILLING_NET + BILLING_TAX; // 4760

async function seedBillingOrder(draft: boolean): Promise<string> {
  const email = draft ? "wiki-billing-draft@example.com" : "wiki-billing@example.com";
  // Cascade-deletes any quotes/invoices from a previous run, freeing unique numbers.
  await prismaTest.order.deleteMany({ where: { customerEmail: email } });

  const phase =
    (await prismaTest.orderPhase.findFirst({ orderBy: { position: "asc" } })) ??
    (await prismaTest.orderPhase.create({
      data: { name: "Eingegangen", color: "#6366f1", position: 0, isDefault: true },
    }));

  const order = await prismaTest.order.create({
    data: {
      customerName: "Müller Konstruktion GmbH",
      customerEmail: email,
      description: "Gehäuse-Set für Sensorbox (3 Teile, PETG)",
      phaseId: phase.id,
    },
  });

  const quoteItems = BILLING_ITEMS.map((it, i) => ({
    position: i,
    description: it.description,
    quantity: it.quantity,
    unitPriceCents: it.unitPriceCents,
    taxRatePercent: 19,
    category: it.category,
    source: it.source,
  }));
  const suffix = Date.now() % 100000;

  if (draft) {
    await prismaTest.quote.create({
      data: {
        orderId: order.id,
        version: 1,
        status: "DRAFT",
        totalCents: BILLING_TOTAL,
        taxCents: BILLING_TAX,
        notes: "Preise inkl. Material. Schätzpositionen können sich nach dem Druck noch ändern.",
        items: { create: quoteItems },
      },
    });
  } else {
    const quote = await prismaTest.quote.create({
      data: {
        orderId: order.id,
        version: 1,
        status: "APPROVED",
        number: `AN-2026-${suffix}`,
        totalCents: BILLING_TOTAL,
        taxCents: BILLING_TAX,
        sentAt: new Date(Date.now() - 6 * 86400000),
        approvedAt: new Date(Date.now() - 5 * 86400000),
        items: { create: quoteItems },
      },
    });
    await prismaTest.invoice.create({
      data: {
        orderId: order.id,
        quoteId: quote.id,
        status: "PARTIALLY_PAID",
        number: `RE-2026-${suffix}`,
        totalCents: BILLING_TOTAL,
        taxCents: BILLING_TAX,
        kleinunternehmer: false,
        issuedAt: new Date(Date.now() - 3 * 86400000),
        dueAt: new Date(Date.now() + 11 * 86400000),
        items: {
          create: BILLING_ITEMS.map((it, i) => ({
            position: i,
            description: it.description,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            taxRatePercent: 19,
            category: it.category,
          })),
        },
        payments: {
          create: [{ amountCents: 2000, paidAt: new Date(Date.now() - 86400000), method: "SEPA" }],
        },
      },
    });
  }
  return order.id;
}

test("screenshot: billing (order detail with quote + invoice)", async ({ page }) => {
  const orderId = await seedBillingOrder(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 1180 });
  await page.goto(`/admin/orders/${orderId}`);
  await page.waitForLoadState("domcontentloaded");
  // Wait for the quote card to render so the billing area is present
  await page.getByText("Angebot", { exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "billing.png"), fullPage: false });
});

test("screenshot: billing-quote (quote editor dialog)", async ({ page }) => {
  const orderId = await seedBillingOrder(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/admin/orders/${orderId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByText("Angebot", { exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Open the quote editor dialog via the draft card's "Bearbeiten" button.
  const editBtn = page.getByRole("button", { name: "Bearbeiten" }).first();
  let captured = false;
  try {
    await editBtn.click({ timeout: 5000 });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    await dialog.screenshot({ path: path.join(OUTPUT_DIR, "billing-quote.png") });
    captured = true;
  } catch {
    captured = false;
  }
  if (!captured) {
    // Fallback: viewport shot still shows the quote card
    await page.screenshot({ path: path.join(OUTPUT_DIR, "billing-quote.png"), fullPage: false });
  }
});

// Custom screenshot: jobs page in Board (queue) view
test("screenshot: jobs-board (Board view)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/jobs");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  // Switch from Gantt to Board view
  const boardButton = page.getByRole("button", { name: "Board" });
  if (await boardButton.isVisible()) {
    await boardButton.click();
    await page.waitForTimeout(400);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "jobs-board.png"),
    fullPage: false,
  });
});
