import { test, expect } from "../fixtures/test-base";
import { createTestOrder, prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Dashboard Gantt view", () => {
  test("toggle shows Gantt view and subtitle", async ({ seed, page }) => {
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    await expect(page.getByText("Gantt-Ansicht")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Monat" }).first()).toBeVisible();
  });

  test("order bar is visible in Gantt view", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 20);

    await createTestOrder(phase!.id, {
      customerName: "Gantt Balken Kunde",
      deadline,
    });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    await expect(page.getByText("Gantt Balken Kunde").first()).toBeVisible();
  });

  test("milestone diamond visible in Gantt view", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const order = await createTestOrder(phase!.id, {
      customerName: "Meilenstein Gantt Kunde",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await prismaTest.milestone.create({
      data: {
        orderId: order.id,
        name: "Gantt Meilenstein",
        dueAt: dueDate,
        color: "#6366f1",
      },
    });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    const diamond = page.locator('[title*="Gantt Meilenstein"]').first();
    await expect(diamond).toBeAttached();
  });

  test("click order bar navigates to order detail", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 20);

    const order = await createTestOrder(phase!.id, {
      customerName: "Klick Gantt Kunde",
      deadline,
    });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    const bar = page.locator(`[title*="Klick Gantt Kunde"]`).first();
    await expect(bar).toBeAttached();
    await bar.click();

    await expect(page).toHaveURL(new RegExp(`/admin/orders/${order.id}`));
  });

  test("switching back to Kanban shows order cards", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();

    await createTestOrder(phase!.id, { customerName: "Kanban Zurück Kunde" });

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();
    await page.getByRole("button", { name: "Kanban", exact: true }).click();

    await expect(page.getByText("Kanban Zurück Kunde").first()).toBeVisible();
  });
});
