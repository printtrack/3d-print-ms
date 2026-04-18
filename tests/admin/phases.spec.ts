import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

test.describe("Phase management", () => {
  test("shows all default phases", async ({ seed, page }) => {
    await page.goto("/admin/phases");
    await expect(page.getByText("Eingegangen").first()).toBeVisible();
    await expect(page.getByText("In Bearbeitung").first()).toBeVisible();
    await expect(page.getByText("Abgeschlossen").first()).toBeVisible();
  });

  test("can create a new phase", async ({ seed, page }) => {
    await page.goto("/admin/phases");

    await page.getByRole("button", { name: /Phase hinzufügen/i }).click();

    await page.getByLabel("Name *").fill("Test Phase E2E");
    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(page.getByText("Test Phase E2E").first()).toBeVisible({ timeout: 5000 });
  });

  test("can edit a phase name", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Edit Me Phase", color: "#ff0000", position: 99 },
    });

    await page.goto("/admin/phases");
    await expect(page.getByText("Edit Me Phase").first()).toBeVisible();

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Edit Me Phase" });
    await row.getByRole("button").nth(1).click(); // 0=grip, 1=pencil, 2=trash

    await page.getByLabel("Name *").clear();
    await page.getByLabel("Name *").fill("Edited Phase Name");
    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(page.getByText("Edited Phase Name").first()).toBeVisible({ timeout: 5000 });
  });

  test("can set isSurvey on a phase and see badge", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Survey Trigger Phase", color: "#10b981", position: 97 },
    });

    await page.goto("/admin/phases");
    await expect(page.getByText("Survey Trigger Phase").first()).toBeVisible();

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Survey Trigger Phase" });
    await row.getByRole("button").nth(1).click(); // pencil

    await page.getByLabel(/Umfrageauslöser/i).check();
    await page.getByRole("button", { name: /^Speichern$/ }).click();

    const phaseRow = page.locator('[data-testid="phase-row"]').filter({ hasText: "Survey Trigger Phase" });
    await expect(phaseRow.getByText("Umfrage")).toBeVisible({ timeout: 5000 });
  });

  test("can delete a phase with no orders", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Delete Me Phase", color: "#cccccc", position: 98 },
    });

    const phasesRefreshed = page.waitForResponse(
      (r) => r.url().includes("/api/admin/phases") && r.request().method() === "GET"
    );
    await page.goto("/admin/phases");
    await expect(page.getByText("Delete Me Phase").first()).toBeVisible();
    await phasesRefreshed;

    page.on("dialog", (dialog) => dialog.accept());

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Delete Me Phase" });
    await row.getByRole("button").nth(2).click(); // 0=grip, 1=pencil, 2=trash

    await expect(page.locator('[data-testid="phase-row"]').filter({ hasText: "Delete Me Phase" })).toHaveCount(0, { timeout: 5000 });
  });

  test("count badge excludes archived orders", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Archive Count Test Phase", color: "#999999", position: 96 },
    });
    await prismaTest.order.create({
      data: {
        customerName: "Archived Customer",
        customerEmail: "archived@example.com",
        description: "Archived order",
        phaseId: phase.id,
        archivedAt: new Date(),
      },
    });

    await page.goto("/admin/phases");
    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Archive Count Test Phase" });
    await expect(row.getByText("0 Aufträge")).toBeVisible();
  });

  test("can delete a phase that only has archived orders", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Archived Only Phase", color: "#888888", position: 95 },
    });
    const archivedOrder = await prismaTest.order.create({
      data: {
        customerName: "Archived Customer",
        customerEmail: "archived@example.com",
        description: "Archived order",
        phaseId: phase.id,
        archivedAt: new Date(),
      },
    });

    await page.goto("/admin/phases");
    await expect(page.getByText("Archived Only Phase").first()).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Archived Only Phase" });
    await row.getByRole("button").nth(2).click(); // trash

    await expect(page.locator('[data-testid="phase-row"]').filter({ hasText: "Archived Only Phase" })).toHaveCount(0, { timeout: 5000 });

    // Verify the archived order still exists, reassigned away from the deleted phase
    const order = await prismaTest.order.findUnique({ where: { id: archivedOrder.id } });
    expect(order).not.toBeNull();
    expect(order!.phaseId).not.toBe(phase.id);
  });

  test("delete button is disabled for phase with active orders", async ({ seed, page }) => {
    const phase = await prismaTest.orderPhase.create({
      data: { name: "Active Orders Phase", color: "#ff5533", position: 94 },
    });
    await prismaTest.order.create({
      data: {
        customerName: "Active Customer",
        customerEmail: "active@example.com",
        description: "Active order",
        phaseId: phase.id,
      },
    });

    await page.goto("/admin/phases");
    await expect(page.getByText("Active Orders Phase").first()).toBeVisible();

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: "Active Orders Phase" });
    await expect(row.getByRole("button").nth(2)).toBeDisabled();
  });
});
