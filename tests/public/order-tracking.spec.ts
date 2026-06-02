import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestAuditLog } from "../fixtures/db";

test.describe("Order tracking page", () => {
  let trackingToken: string;

  test.beforeEach(async ({ seed }) => {
    // Get the first default phase (Eingegangen)
    const phase = await prismaTest.orderPhase.findFirst({
      where: { isDefault: true },
    });
    if (!phase) throw new Error("No default phase found — did global-setup run?");

    const order = await createTestOrder(phase.id, {
      customerName: "Track Tester",
      customerEmail: "track@example.com",
      description: "Tracking test order",
    });
    trackingToken = order.trackingToken;
  });

  test("shows order details for a valid token", async ({ page }) => {
    await page.goto(`/track/${trackingToken}`);

    await expect(page.getByRole("heading", { name: /Auftragsstatus/i })).toBeVisible();
    await expect(page.getByText("Track Tester")).toBeVisible();
    await expect(page.getByText("Tracking test order")).toBeVisible();
  });

  test("shows the current phase", async ({ page }) => {
    await page.goto(`/track/${trackingToken}`);
    await expect(page.getByText("Eingegangen")).toBeVisible();
  });

  test("returns 404 for an invalid token", async ({ page }) => {
    const response = await page.goto("/track/invalid-token-that-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("has a link back to the submission form", async ({ page }) => {
    await page.goto(`/track/${trackingToken}`);
    const backLink = page.getByRole("link", { name: /Neuen Auftrag einreichen/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL("/");
  });

  test("shows team files section when team files exist", async ({ page }) => {
    // Insert a team file record directly into the DB
    const order = await prismaTest.order.findFirst({ where: { trackingToken } });
    await prismaTest.orderFile.create({
      data: {
        orderId: order!.id,
        filename: "team-design.png",
        originalName: "design.png",
        mimeType: "image/png",
        size: 1024,
        source: "TEAM",
      },
    });

    await page.goto(`/track/${trackingToken}`);
    // New design: unified "Dateien" card with category tabs; team files show a "Team" badge
    await expect(page.getByText(/^Dateien \(/)).toBeVisible();
    await expect(page.getByText("Team").first()).toBeVisible();
  });

  test("does not show files section when no files exist", async ({ page }) => {
    await page.goto(`/track/${trackingToken}`);
    await expect(page.getByText(/^Dateien \(/)).not.toBeVisible();
  });

  test("shows survey CTA when a survey has been sent but not yet submitted", async ({ page }) => {
    const order = await prismaTest.order.findFirst({ where: { trackingToken } });
    await prismaTest.surveyResponse.create({ data: { orderId: order!.id } });

    await page.goto(`/track/${trackingToken}`);
    await expect(page.getByText(/Ihr Feedback/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Jetzt Feedback geben/i })).toBeVisible();
  });

  test("shows thank-you when survey has been submitted", async ({ page }) => {
    const order = await prismaTest.order.findFirst({ where: { trackingToken } });
    await prismaTest.surveyResponse.create({
      data: {
        orderId: order!.id,
        submittedAt: new Date(),
        answers: [{ question: "Qualität?", rating: 5 }],
      },
    });

    await page.goto(`/track/${trackingToken}`);
    await expect(page.getByText(/Vielen Dank für Ihr Feedback/i)).toBeVisible();
  });

  test.describe("customer timeline visibility", () => {
    // The Setting table is NOT cleared by resetDb(), so each test starts from a
    // clean default state by removing any leftover tracking_* settings.
    test.beforeEach(async () => {
      await prismaTest.setting.deleteMany({ where: { key: { startsWith: "tracking_" } } });
    });

    test("shows whitelisted events but never internal ones", async ({ page }) => {
      const order = await prismaTest.order.findFirst({ where: { trackingToken } });
      // PHASE_CHANGED is customer-visible by default; ASSIGNED is internal.
      await createTestAuditLog(order!.id, "PHASE_CHANGED", { details: "Eingegangen → In Bearbeitung" });
      await createTestAuditLog(order!.id, "ASSIGNED", { details: "Max Mustermann" });

      await page.goto(`/track/${trackingToken}`);
      await expect(page.getByText("Verlauf")).toBeVisible();
      await expect(page.getByText("Status geändert")).toBeVisible();
      // Internal event must not reach the browser at all.
      await expect(page.getByText("Bearbeiter zugewiesen")).toHaveCount(0);
      await expect(page.getByText("Max Mustermann")).toHaveCount(0);
    });

    test("billing events are hidden by default and appear once enabled", async ({ page }) => {
      const order = await prismaTest.order.findFirst({ where: { trackingToken } });
      await createTestAuditLog(order!.id, "QUOTE_SENT", { details: "Angebot A-2026-001" });
      // A visible event so the timeline card renders regardless.
      await createTestAuditLog(order!.id, "PHASE_CHANGED");

      await page.goto(`/track/${trackingToken}`);
      await expect(page.getByText("Status geändert")).toBeVisible();
      await expect(page.getByText("Angebot gesendet")).toHaveCount(0);

      // Enable the billing event explicitly.
      await prismaTest.setting.upsert({
        where: { key: "tracking_event_QUOTE_SENT" },
        update: { value: "true" },
        create: { key: "tracking_event_QUOTE_SENT", value: "true" },
      });

      await page.goto(`/track/${trackingToken}`);
      await expect(page.getByText("Angebot gesendet")).toBeVisible();
    });

    test("master switch hides the whole timeline card", async ({ page }) => {
      const order = await prismaTest.order.findFirst({ where: { trackingToken } });
      await createTestAuditLog(order!.id, "PHASE_CHANGED");
      await prismaTest.setting.upsert({
        where: { key: "tracking_timeline_enabled" },
        update: { value: "false" },
        create: { key: "tracking_timeline_enabled", value: "false" },
      });

      await page.goto(`/track/${trackingToken}`);
      await expect(page.getByText("Status geändert")).toHaveCount(0);
      await expect(page.getByText("Verlauf")).toHaveCount(0);
    });
  });
});
