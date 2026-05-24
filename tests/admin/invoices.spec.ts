import { test, expect } from "../fixtures/test-base";
import type { APIRequestContext } from "@playwright/test";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

async function ensureSetting(key: string, value: string) {
  await prismaTest.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function triggerAutoTransition(request: APIRequestContext) {
  const res = await request.post("/api/admin/invoices/auto-transition");
  if (!res.ok()) throw new Error(`auto-transition failed: ${res.status()}`);
  return res.json();
}

async function findPhase(name: string) {
  const phase = await prismaTest.orderPhase.findFirst({ where: { name } });
  if (!phase) throw new Error(`Phase ${name} not found`);
  return phase;
}

async function createApprovedQuote(orderId: string, totalCents = 1190, taxCents = 190, version = 1) {
  return prismaTest.quote.create({
    data: {
      orderId,
      version,
      status: "APPROVED",
      sentAt: new Date(),
      approvedAt: new Date(),
      number: `ANG-TEST-${Date.now()}`.slice(0, 30),
      totalCents,
      taxCents,
      items: {
        create: [
          {
            position: 0,
            description: "Test-Druckkosten",
            quantity: 1,
            unitPriceCents: totalCents,
            taxRatePercent: 0, // 0% so computeInvoiceTotals gives exactly totalCents without extra VAT
            category: "FILAMENT",
            source: "FIXED",
          },
        ],
      },
    },
    include: { items: true },
  });
}

test("creating an invoice from an approved quote produces a DRAFT", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Invoice Happy" });
  const quote = await createApprovedQuote(order.id);

  const res = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: quote.id },
  });
  expect(res.ok()).toBeTruthy();
  const invoice = await res.json();
  expect(invoice.status).toBe("DRAFT");
  expect(invoice.number).toBeNull();
  expect(invoice.totalCents).toBe(1190);
  expect(invoice.items).toHaveLength(1);
});

test("issuing a draft invoice allocates a number, archives PDF, transitions phase", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const invoicePending = await findPhase("Rechnung offen");
  const order = await createTestOrder(inPruefung.id, { customerName: "Invoice Issue" });
  const quote = await createApprovedQuote(order.id);

  const draftRes = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: quote.id },
  });
  const draft = await draftRes.json();

  const issueRes = await page.request.post(`/api/admin/invoices/${draft.id}/issue`);
  expect(issueRes.ok()).toBeTruthy();
  const issued = await issueRes.json();
  expect(issued.status).toBe("ISSUED");
  expect(issued.number).toMatch(/^RG-\d{4}-\d{4}$/);
  expect(issued.issuedAt).not.toBeNull();
  expect(issued.pdfPath).toContain("/uploads/invoices/");

  const updatedOrder = await prismaTest.order.findUnique({
    where: { id: order.id },
    select: { phaseId: true },
  });
  expect(updatedOrder?.phaseId).toBe(invoicePending.id);
});

test("issuing two invoices in a row allocates sequential numbers", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const orderA = await createTestOrder(inPruefung.id, { customerName: "Numbering A" });
  const orderB = await createTestOrder(inPruefung.id, { customerName: "Numbering B" });
  const quoteA = await createApprovedQuote(orderA.id);
  const quoteB = await createApprovedQuote(orderB.id);

  const draftA = await (await page.request.post(`/api/admin/orders/${orderA.id}/invoices`, { data: { quoteId: quoteA.id } })).json();
  const draftB = await (await page.request.post(`/api/admin/orders/${orderB.id}/invoices`, { data: { quoteId: quoteB.id } })).json();

  const issuedA = await (await page.request.post(`/api/admin/invoices/${draftA.id}/issue`)).json();
  const issuedB = await (await page.request.post(`/api/admin/invoices/${draftB.id}/issue`)).json();

  const nA = parseInt(issuedA.number.split("-").pop()!, 10);
  const nB = parseInt(issuedB.number.split("-").pop()!, 10);
  expect(nB).toBe(nA + 1);
});

test("cannot issue an invoice without an approved quote", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Quote Sent Only" });
  const quote = await prismaTest.quote.create({
    data: {
      orderId: order.id,
      version: 1,
      status: "SENT",
      totalCents: 1190,
      taxCents: 190,
    },
  });

  const res = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: quote.id },
  });
  expect(res.status()).toBe(409);
});

test("storno creates a negative twin and marks original CANCELLED", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Storno Test" });
  const quote = await createApprovedQuote(order.id, 2380, 380);

  const draftRes = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: quote.id },
  });
  const draft = await draftRes.json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  const cancelRes = await page.request.post(`/api/admin/invoices/${issued.id}/cancel`);
  expect(cancelRes.ok()).toBeTruthy();
  const { original, storno } = await cancelRes.json();
  expect(original.status).toBe("CANCELLED");
  expect(original.cancelledAt).not.toBeNull();
  expect(storno.totalCents).toBe(-2380);
  expect(storno.reverseOfId).toBe(issued.id);
});

test("recording a payment >= total marks invoice PAID", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const done = await findPhase("Abgeschlossen");
  const order = await createTestOrder(inPruefung.id, { customerName: "Paid Test" });
  const quote = await createApprovedQuote(order.id, 1000, 0);

  const draft = await (await page.request.post(`/api/admin/orders/${order.id}/invoices`, { data: { quoteId: quote.id } })).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  const paymentRes = await page.request.post(`/api/admin/invoices/${issued.id}/payments`, {
    data: {
      amountCents: 1000,
      paidAt: new Date().toISOString(),
      method: "SEPA",
      reference: issued.number,
    },
  });
  expect(paymentRes.ok()).toBeTruthy();

  const inv = await prismaTest.invoice.findUnique({ where: { id: issued.id } });
  expect(inv?.status).toBe("PAID");

  // Phase should be auto-synced to "Abgeschlossen" directly by the payment endpoint
  const orderAfter = await prismaTest.order.findUnique({ where: { id: order.id }, select: { phaseId: true } });
  expect(orderAfter?.phaseId).toBe(done.id);
});

test("partial payment yields PARTIALLY_PAID status", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Partial" });
  const quote = await createApprovedQuote(order.id, 5000, 0);

  const draft = await (await page.request.post(`/api/admin/orders/${order.id}/invoices`, { data: { quoteId: quote.id } })).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  await page.request.post(`/api/admin/invoices/${issued.id}/payments`, {
    data: { amountCents: 2000, paidAt: new Date().toISOString(), method: "CASH" },
  });

  const inv = await prismaTest.invoice.findUnique({ where: { id: issued.id } });
  expect(inv?.status).toBe("PARTIALLY_PAID");
});

test("draft invoice can be deleted, issued cannot", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id);
  const quote = await createApprovedQuote(order.id);

  const draft = await (await page.request.post(`/api/admin/orders/${order.id}/invoices`, { data: { quoteId: quote.id } })).json();
  const delDraft = await page.request.delete(`/api/admin/invoices/${draft.id}`);
  expect(delDraft.ok()).toBeTruthy();

  const quote2 = await createApprovedQuote(order.id, 1190, 190, 2);
  const draft2 = await (await page.request.post(`/api/admin/orders/${order.id}/invoices`, { data: { quoteId: quote2.id } })).json();
  await page.request.post(`/api/admin/invoices/${draft2.id}/issue`);
  const delIssued = await page.request.delete(`/api/admin/invoices/${draft2.id}`);
  expect(delIssued.status()).toBe(409);
});

test("invoice PDF endpoint returns valid PDF for issued invoice", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "PDF Invoice" });
  const quote = await createApprovedQuote(order.id);

  const draft = await (await page.request.post(`/api/admin/orders/${order.id}/invoices`, { data: { quoteId: quote.id } })).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  const pdfRes = await page.request.get(`/api/admin/invoices/${issued.id}/pdf`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
  const body = await pdfRes.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");

  // Customer endpoint
  const customerRes = await page.request.get(`/api/orders/${order.trackingToken}/invoice-pdf`);
  expect(customerRes.status()).toBe(200);
});

test("auto-transition flips ISSUED to OVERDUE when dueAt is past", async ({ seed, page }) => {
  void seed;
  await ensureSetting("payment_reminders_enabled", "false"); // isolate from reminder side-effects
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Overdue Sweep" });
  const quote = await createApprovedQuote(order.id, 5000, 0);

  const draft = await (
    await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
      data: { quoteId: quote.id },
    })
  ).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  // Backdate dueAt so it's already past
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  const result = await triggerAutoTransition(page.request);
  expect(result.overdue).toBeGreaterThanOrEqual(1);

  const after = await prismaTest.invoice.findUnique({ where: { id: issued.id } });
  expect(after?.status).toBe("OVERDUE");
});

test("payment reminders fire at correct stage and apply fees", async ({ seed, page }) => {
  void seed;
  await ensureSetting("payment_reminders_enabled", "true");
  await ensureSetting("payment_reminder_days_before", "3");
  await ensureSetting("payment_reminder_days_after_1", "7");
  await ensureSetting("payment_reminder_days_after_2", "21");
  await ensureSetting("payment_reminder_days_after_3", "42");
  await ensureSetting("payment_reminder_fee_2_cents", "500");
  await ensureSetting("payment_reminder_fee_3_cents", "1000");

  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Reminder Flow" });
  const quote = await createApprovedQuote(order.id, 5000, 0);
  const draft = await (
    await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
      data: { quoteId: quote.id },
    })
  ).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  // Stage 1: dueAt 8 days ago → daysAfter1 reached
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
  });
  let res = await triggerAutoTransition(page.request);
  expect(res.reminders.byStage[1]).toBe(1);

  // Running again must NOT re-send stage 1
  res = await triggerAutoTransition(page.request);
  expect(res.reminders.remindersSent).toBe(0);

  // Stage 2: dueAt 22 days ago → daysAfter2 reached, fee applies
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000) },
  });
  res = await triggerAutoTransition(page.request);
  expect(res.reminders.byStage[2]).toBe(1);
  const stage2 = await prismaTest.paymentReminder.findFirst({
    where: { invoiceId: issued.id, stage: 2 },
  });
  expect(stage2?.feeCents).toBe(500);

  // Stage 3 with higher fee
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 43 * 24 * 60 * 60 * 1000) },
  });
  res = await triggerAutoTransition(page.request);
  expect(res.reminders.byStage[3]).toBe(1);
  const stage3 = await prismaTest.paymentReminder.findFirst({
    where: { invoiceId: issued.id, stage: 3 },
  });
  expect(stage3?.feeCents).toBe(1000);

  // Audit log entries should exist for each reminder
  const audits = await prismaTest.auditLog.findMany({
    where: { orderId: order.id, action: "REMINDER_SENT" },
  });
  expect(audits.length).toBeGreaterThanOrEqual(3);
});

test("payment reminders skip fully paid invoices", async ({ seed, page }) => {
  void seed;
  await ensureSetting("payment_reminders_enabled", "true");

  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Paid No Reminder" });
  const quote = await createApprovedQuote(order.id, 3000, 0);
  const draft = await (
    await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
      data: { quoteId: quote.id },
    })
  ).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();

  // Pay fully — invoice flips to PAID, status is excluded from reminder sweep anyway
  await page.request.post(`/api/admin/invoices/${issued.id}/payments`, {
    data: { amountCents: 3000, paidAt: new Date().toISOString(), method: "SEPA" },
  });

  // Backdate so it *would* qualify if status check were missing
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  const res = await triggerAutoTransition(page.request);
  expect(res.reminders.remindersSent).toBe(0);
});

test("disabling reminders setting halts the sweep", async ({ seed, page }) => {
  void seed;
  await ensureSetting("payment_reminders_enabled", "false");

  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Reminders Off" });
  const quote = await createApprovedQuote(order.id, 1000, 0);
  const draft = await (
    await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
      data: { quoteId: quote.id },
    })
  ).json();
  const issued = await (await page.request.post(`/api/admin/invoices/${draft.id}/issue`)).json();
  await prismaTest.invoice.update({
    where: { id: issued.id },
    data: { dueAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  const res = await triggerAutoTransition(page.request);
  expect(res.reminders.remindersSent).toBe(0);

  // Re-enable for other tests
  await ensureSetting("payment_reminders_enabled", "true");
});

test("ESTIMATE quote items get replaced with actual iteration costs", async ({ seed, page }) => {
  void seed;
  const inPruefung = await findPhase("In Prüfung");
  const order = await createTestOrder(inPruefung.id, { customerName: "Transform Test" });
  const partPhase = await prismaTest.partPhase.findFirst({ where: { isDefault: true } });
  if (!partPhase) throw new Error("default part phase missing");
  const part = await prismaTest.orderPart.create({
    data: { orderId: order.id, name: "Halter", partPhaseId: partPhase.id },
  });
  await prismaTest.orderPartIteration.create({
    data: {
      orderPartId: part.id,
      pieceIndex: 0,
      result: "SUCCESS",
      gramsActual: 50,
      chargedCents: 750, // 7,50 € real cost
    },
  });

  const quote = await prismaTest.quote.create({
    data: {
      orderId: order.id,
      version: 1,
      status: "APPROVED",
      sentAt: new Date(),
      approvedAt: new Date(),
      number: `ANG-EST-${Date.now()}`.slice(0, 30),
      totalCents: 1190,
      taxCents: 190,
      items: {
        create: [
          {
            position: 0,
            description: "Druckkosten (geschätzt)",
            quantity: 1,
            unitPriceCents: 1000,
            taxRatePercent: 19,
            category: "FILAMENT",
            source: "ESTIMATE",
            orderPartId: part.id,
          },
        ],
      },
    },
  });

  const res = await page.request.post(`/api/admin/orders/${order.id}/invoices`, {
    data: { quoteId: quote.id },
  });
  expect(res.ok()).toBeTruthy();
  const invoice = await res.json();
  // Should use 750 (actual) instead of 1000 (estimate)
  expect(invoice.items[0].unitPriceCents).toBe(750);
  expect(invoice.items[0].description).toContain("Halter");
  expect(invoice.items[0].description).toContain("50 g");
});
