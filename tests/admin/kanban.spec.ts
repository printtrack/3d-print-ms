import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.describe("Kanban board", () => {
  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");
    await createTestOrder(phase.id, {
      customerName: "Kanban Tester",
      customerEmail: "kanban@example.com",
      description: "Kanban board test order",
    });
  });

  test("renders the dashboard with kanban board", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: /Aufträge/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Eingegangen" })).toBeVisible();
  });

  test("shows order cards", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByText("Kanban Tester").first()).toBeVisible();
  });

  test("search filters orders", async ({ page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    await createTestOrder(phase!.id, {
      customerName: "UniqueSearchableName",
      description: "Searchable order",
    });

    await page.goto("/admin/orders");

    const searchInput = page.getByPlaceholder("Aufträge suchen...");
    await searchInput.fill("UniqueSearchableName");
    await searchInput.press("Enter");

    await page.waitForURL(/search=/);
    await expect(page.getByText("UniqueSearchableName").first()).toBeVisible();
  });

  test("shows archive tab", async ({ page }) => {
    await page.goto("/admin/orders");
    const archiveTab = page.getByRole("link", { name: /Archiv/i });
    await expect(archiveTab).toBeVisible();
    await archiveTab.click();
    await page.waitForURL(/tab=archiv/);
    await expect(page.getByRole("heading", { name: /Archiv/i })).toBeVisible();
  });

  test("order card links to order detail", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByText("Kanban Tester").first().click();
    await page.waitForURL(/\/admin\/orders\//);
    await expect(page.url()).toContain("/admin/orders/");
  });

  test("admin nav shows einstellungen link", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("link", { name: /Einstellungen/i })).toBeVisible();
  });

  test("archive drop zone is visible on the board", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByText("Archiv").first()).toBeVisible();
  });

  test("order card shows price badge when priceEstimate is set", async ({ page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    await prismaTest.order.create({
      data: {
        customerName: "PriceBadgeTester",
        customerEmail: "pricebadge@example.com",
        description: "Order with price",
        phaseId: phase!.id,
        priceEstimate: 19.99,
      },
    });

    await page.goto("/admin/orders");
    await expect(page.getByText("19.99 €").first()).toBeVisible();
  });
});
