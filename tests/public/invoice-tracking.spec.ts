import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

// Public /track page must surface the active invoice (with number, status badge,
// outstanding amount and bank details) once it has been issued.

test("track page shows issued invoice with status and amount", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "Invoice Track" });

  const invoice = await prismaTest.invoice.create({
    data: {
      orderId: order.id,
      number: `RG-${new Date().getFullYear()}-9001`,
      status: "ISSUED",
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      totalCents: 4200,
      taxCents: 670,
      kleinunternehmer: false,
      items: {
        create: [
          {
            position: 0,
            description: "Druckposten Test",
            quantity: 1,
            unitPriceCents: 3530,
            taxRatePercent: 19,
            category: "FILAMENT",
          },
        ],
      },
    },
  });

  await page.goto(`/track/${order.trackingToken}`);
  await expect(page.getByText(invoice.number!).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/42[\.,]00/)).toBeVisible();

  // PDF endpoint is reachable via tracking token
  const pdfRes = await page.request.get(`/api/orders/${order.trackingToken}/invoice-pdf`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
});

test("track page highlights overdue invoice", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "Overdue Track" });

  await prismaTest.invoice.create({
    data: {
      orderId: order.id,
      number: `RG-${new Date().getFullYear()}-9002`,
      status: "OVERDUE",
      issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dueAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      totalCents: 2500,
      taxCents: 0,
      kleinunternehmer: true,
    },
  });

  await page.goto(`/track/${order.trackingToken}`);
  // Status badge should reflect overdue text in either language
  await expect(
    page.getByText(/Überfällig|Overdue/i).first()
  ).toBeVisible({ timeout: 5000 });
});
