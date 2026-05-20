import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Customer contact tab", () => {
  test("shows email hint with customer address", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Kontakt Tester",
      customerEmail: "kontakt@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    // Email appears in both the order header and the hint — scope to the tab panel
    await expect(page.getByRole("tabpanel").getByText("kontakt@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("Nachricht an Kunde schreiben...")).toBeVisible();
    await expect(page.getByRole("button", { name: /An Kunde senden/i })).toBeDisabled();
  });

  test("send button enables only when text is entered", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerEmail: "enable@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    const button = page.getByRole("button", { name: /An Kunde senden/i });
    await expect(button).toBeDisabled();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("Hallo!");
    await expect(button).toBeEnabled();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("");
    await expect(button).toBeDisabled();
  });

  test("happy path: sending customer message creates comment + audit log entry", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Happy Path Kunde",
      customerEmail: "happy@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("Ihr Druck ist fertig!");
    await page.getByRole("button", { name: /An Kunde senden/i }).click();

    // Message appears in Kundenkontakt tab with badge
    await expect(page.getByText("Ihr Druck ist fertig!")).toBeVisible();
    await expect(page.getByText("An Kunde gesendet")).toBeVisible();

    // DB: comment with sentToCustomer=true
    const comment = await prismaTest.orderComment.findFirst({
      where: { orderId: order.id, sentToCustomer: true },
    });
    expect(comment).not.toBeNull();
    expect(comment?.content).toBe("Ihr Druck ist fertig!");

    // DB: audit log entry
    const audit = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "CUSTOMER_MESSAGE_SENT" },
    });
    expect(audit).not.toBeNull();
  });

  test("customer message does NOT appear in Kommentare tab", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerEmail: "separation@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("Nur für Kunden");
    await page.getByRole("button", { name: /An Kunde senden/i }).click();
    await expect(page.getByText("Nur für Kunden")).toBeVisible();

    // Switch to Kommentare — message must not appear there
    await page.getByRole("tab", { name: "Kommentare" }).click();
    await expect(page.getByText("Nur für Kunden")).not.toBeVisible();
    await expect(page.getByText("Noch keine Kommentare")).toBeVisible();
  });

  test("customer message appears in Alle tab with badge", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerEmail: "alle@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("Für Alle sichtbar");
    await page.getByRole("button", { name: /An Kunde senden/i }).click();
    await expect(page.getByText("Für Alle sichtbar")).toBeVisible();

    // Verify in Alle tab
    await page.getByRole("tab", { name: "Alle" }).click();
    await expect(page.getByText("Für Alle sichtbar")).toBeVisible();
    // Badge visible in Alle tab too
    await expect(page.getByText("An Kunde gesendet").first()).toBeVisible();
  });

  test("CUSTOMER_MESSAGE_SENT audit entry appears in Verlauf tab", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerEmail: "verlauf@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();

    await page.getByPlaceholder("Nachricht an Kunde schreiben...").fill("Verlauf Test");
    await page.getByRole("button", { name: /An Kunde senden/i }).click();
    await expect(page.getByText("Verlauf Test")).toBeVisible();

    // Audit entry in Verlauf tab
    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText("Kundennachricht gesendet")).toBeVisible();
  });
});
