import { test, expect } from "../fixtures/test-base";

test.use({ storageState: "tests/.auth/admin.json" });

test("navigates to planning page and shows heading", async ({ seed, page }) => {
  await page.goto("/admin/planning");
  await expect(page.getByRole("heading", { name: "Planung" })).toBeVisible();
});

test("planning page defaults to Resource view", async ({ seed, page }) => {
  await page.goto("/admin/planning");
  await expect(page.getByRole("button", { name: "Ressourcen" })).toBeVisible();
  await expect(page.getByText("Monat")).toBeVisible();
});

test("toggle to calendar view shows month grid", async ({ seed, page }) => {
  await page.goto("/admin/planning");

  await page.getByRole("button", { name: "Kalender" }).click();

  await expect(page.getByText("Mo").first()).toBeVisible();
  await expect(page.getByText("So").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Heute" })).toBeVisible();
});

test("resource view shows Admin user row", async ({ seed, page }) => {
  await page.goto("/admin/planning");
  await expect(page.getByText("Admin").first()).toBeVisible();
});
