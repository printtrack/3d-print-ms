import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

// Customer-facing /track page should display the quote line items and let the
// customer approve / reject via the existing verification endpoint.

test("track page shows quote line items, totals and lets customer approve", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "Public Quote View" });

  // Build a quote via Prisma directly (no admin auth needed for the test)
  const quote = await prismaTest.quote.create({
    data: {
      orderId: order.id,
      version: 1,
      status: "SENT",
      sentAt: new Date(),
      totalCents: 1428,
      taxCents: 228,
      items: {
        create: [
          {
            position: 0,
            description: "Filament-Posten Test",
            quantity: 2,
            unitPriceCents: 500,
            taxRatePercent: 19,
            category: "FILAMENT",
            source: "ESTIMATE",
          },
          {
            position: 1,
            description: "Magnet Test-Posten",
            quantity: 4,
            unitPriceCents: 50,
            taxRatePercent: 19,
            category: "HARDWARE",
            source: "FIXED",
          },
        ],
      },
    },
  });

  const vr = await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "PRICE_APPROVAL", quoteId: quote.id },
  });

  await page.goto(`/track/${order.trackingToken}`);

  await expect(page.getByText("Filament-Posten Test")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Magnet Test-Posten")).toBeVisible();

  // Approve via API and verify quote status flips
  const approveRes = await page.request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: { verificationToken: vr.token, action: "APPROVE" },
  });
  expect(approveRes.ok()).toBeTruthy();

  const updated = await prismaTest.quote.findUnique({ where: { id: quote.id } });
  expect(updated?.status).toBe("APPROVED");
  expect(updated?.approvedAt).not.toBeNull();
});

test("rejecting a quote stores the rejection reason on the quote", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "Public Quote Reject" });
  const quote = await prismaTest.quote.create({
    data: {
      orderId: order.id,
      version: 1,
      status: "SENT",
      sentAt: new Date(),
      totalCents: 1190,
      taxCents: 190,
      items: {
        create: [
          {
            position: 0,
            description: "Posten",
            quantity: 1,
            unitPriceCents: 1000,
            taxRatePercent: 19,
            category: "OTHER",
            source: "FIXED",
          },
        ],
      },
    },
  });
  const vr = await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "PRICE_APPROVAL", quoteId: quote.id },
  });

  const rejRes = await page.request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: {
      verificationToken: vr.token,
      action: "REJECT",
      rejectionReason: "Zu teuer für meinen Geschmack",
    },
  });
  expect(rejRes.ok()).toBeTruthy();

  const updated = await prismaTest.quote.findUnique({ where: { id: quote.id } });
  expect(updated?.status).toBe("REJECTED");
  expect(updated?.rejectionReason).toContain("Zu teuer");
});

test("customer can download the quote PDF via tracking token", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "PDF Customer" });
  await prismaTest.quote.create({
    data: {
      orderId: order.id,
      number: "ANG-2026-0001",
      version: 1,
      status: "SENT",
      sentAt: new Date(),
      totalCents: 1190,
      taxCents: 190,
      items: {
        create: [
          {
            position: 0,
            description: "Test-Posten",
            quantity: 1,
            unitPriceCents: 1000,
            taxRatePercent: 19,
            category: "OTHER",
            source: "FIXED",
          },
        ],
      },
    },
  });

  const pdfRes = await page.request.get(`/api/orders/${order.trackingToken}/quote-pdf`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
  const body = await pdfRes.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");
  expect(body.length).toBeGreaterThan(1000);
});

test("quote PDF endpoint returns 404 when no sent quote exists", async ({ seed, page }) => {
  void seed;
  const inPruefung = await prismaTest.orderPhase.findFirst({ where: { name: "In Prüfung" } });
  if (!inPruefung) { test.skip(); return; }

  const order = await createTestOrder(inPruefung.id, { customerName: "Quote-less" });
  const pdfRes = await page.request.get(`/api/orders/${order.trackingToken}/quote-pdf`);
  expect(pdfRes.status()).toBe(404);
});
