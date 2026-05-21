import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Activity tabs on order detail", () => {
  test("shows all four tabs", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Tab Tester",
      customerEmail: "tabs@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole("tab", { name: "Alle" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Kommentare" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Verlauf" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Kundenkontakt" })).toBeVisible();
  });

  test("internal comment appears in Alle and Kommentare, not in Kundenkontakt", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Comment Tester",
      customerEmail: "comment@example.com",
    });

    await page.goto(`/admin/orders/${order.id}`);

    // Post internal comment via Kommentare tab
    await page.getByRole("tab", { name: "Kommentare" }).click();
    await page.getByPlaceholder("Kommentar schreiben...").fill("Internes Kommentar");
    await page.getByRole("button", { name: "Kommentieren" }).click();
    await expect(page.getByText("Internes Kommentar")).toBeVisible();

    // Should appear in Alle tab too
    await page.getByRole("tab", { name: "Alle" }).click();
    await expect(page.getByText("Internes Kommentar")).toBeVisible();

    // Must NOT appear in Kundenkontakt tab
    await page.getByRole("tab", { name: "Kundenkontakt" }).click();
    await expect(page.getByText("Internes Kommentar")).not.toBeVisible();
    await expect(page.getByText("Noch keine Kundennachrichten")).toBeVisible();
  });

  test("audit entries appear in Alle and Verlauf tabs", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Audit Tester",
    });

    // createTestOrder inserts directly — manually create ORDER_CREATED audit log
    await prismaTest.auditLog.create({
      data: { orderId: order.id, userId: null, action: "ORDER_CREATED", details: "Auftrag eingereicht" },
    });

    await page.goto(`/admin/orders/${order.id}`);

    // Alle tab shows audit entry (ORDER_CREATED)
    await expect(page.getByRole("tab", { name: "Alle" })).toBeVisible();
    await expect(page.getByText("Auftrag eingereicht").first()).toBeVisible({ timeout: 10000 });

    // Verlauf tab also shows it
    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText("Auftrag eingereicht").first()).toBeVisible({ timeout: 10000 });

    // Kommentare tab does not show audit entries
    await page.getByRole("tab", { name: "Kommentare" }).click();
    await expect(page.getByText("Auftrag eingereicht")).not.toBeVisible();
  });

  test("Verlauf tab is read-only (no input field)", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id);
    await page.goto(`/admin/orders/${order.id}`);

    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByPlaceholder("Kommentar schreiben...")).not.toBeVisible();
    await expect(page.getByPlaceholder("Nachricht an Kunde schreiben...")).not.toBeVisible();
  });
});
