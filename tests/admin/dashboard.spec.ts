import { test, expect } from "../fixtures/test-base";

test.describe("Dashboard", () => {
  test("shows the dashboard heading and metric cards", async ({ seed, page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByText("Offene Aufträge")).toBeVisible();
    await expect(page.getByText("Aktive Druckjobs")).toBeVisible();
    await expect(page.getByText("Überfällig")).toBeVisible();
    await expect(page.getByText("Neue Aufträge (Woche)")).toBeVisible();
  });

  test("shows the phase breakdown and activity sections", async ({ seed, page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Aufträge nach Phase")).toBeVisible();
    await expect(page.getByText("Letzte Aktivität")).toBeVisible();
  });

  test("metric card links navigate correctly", async ({ seed, page }) => {
    await page.goto("/admin");
    await page.getByText("Offene Aufträge").click();
    await expect(page).toHaveURL("/admin/orders");
  });
});
