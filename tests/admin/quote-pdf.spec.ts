import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

async function findPhase(name: string) {
  const phase = await prismaTest.orderPhase.findFirst({ where: { name } });
  if (!phase) throw new Error(`Phase ${name} not found`);
  return phase;
}

test("admin can download a quote PDF for a draft quote", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "PDF Tester" });

  const createRes = await page.request.post(`/api/admin/orders/${order.id}/quotes`, {
    data: {
      items: [
        {
          description: "Druckkosten",
          quantity: 1,
          unitPriceCents: 2500,
          taxRatePercent: 19,
          category: "FILAMENT",
          source: "ESTIMATE",
        },
      ],
    },
  });
  const quote = await createRes.json();

  const pdfRes = await page.request.get(`/api/admin/quotes/${quote.id}/pdf`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toContain("application/pdf");

  const body = await pdfRes.body();
  // PDF magic bytes "%PDF"
  expect(body.subarray(0, 4).toString()).toBe("%PDF");
  // Non-empty document
  expect(body.length).toBeGreaterThan(1000);
});

test("PDF endpoint requires authentication", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id);
  const createRes = await page.request.post(`/api/admin/orders/${order.id}/quotes`, {
    data: { items: [{ description: "X", quantity: 1, unitPriceCents: 100, taxRatePercent: 19, category: "OTHER", source: "FIXED" }] },
  });
  const quote = await createRes.json();

  // Use Node.js fetch (no browser auth cookies) to verify the endpoint rejects anonymous requests
  const anonRes = await fetch(`http://localhost:3001/api/admin/quotes/${quote.id}/pdf`);
  expect(anonRes.status).toBe(401);
});

test("sending a quote allocates a numeric quote number", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Quote Number" });

  const createRes = await page.request.post(`/api/admin/orders/${order.id}/quotes`, {
    data: {
      items: [{ description: "X", quantity: 1, unitPriceCents: 100, taxRatePercent: 19, category: "OTHER", source: "FIXED" }],
    },
  });
  const quote = await createRes.json();

  const sendRes = await page.request.post(`/api/admin/quotes/${quote.id}/send`);
  expect(sendRes.ok()).toBeTruthy();
  const sendBody = await sendRes.json();
  expect(sendBody.quoteNumber).toMatch(/^ANG-\d{4}-\d{4}$/);

  const dbQuote = await prismaTest.quote.findUnique({ where: { id: quote.id } });
  expect(dbQuote?.number).toBe(sendBody.quoteNumber);
});
