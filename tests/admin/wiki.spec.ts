import { test, expect } from "../fixtures/test-base";

test.use({ storageState: "tests/.auth/admin.json" });

test("wiki overview loads and shows all sections", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/wiki");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByTestId("wiki-search")).toBeVisible();
});

test("wiki search filters pages", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/wiki");
  const search = page.getByTestId("wiki-search");
  await search.fill("Druckjob");
  const sidebar = page.locator("aside").filter({ has: page.getByTestId("wiki-search") });
  await expect(sidebar.getByRole("link", { name: /Druckjob/i })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Inventar" })).toBeHidden();
});

test("wiki detail page renders content", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/wiki/orders");
  const content = page.getByTestId("wiki-content");
  await expect(content).toBeVisible();
  await expect(content.getByRole("heading").first()).toBeVisible();
});

test("wiki wikilinks navigate to target page", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/wiki/orders");
  const wikilinkChip = page.locator('[data-testid="wiki-content"] a[href*="/admin/wiki/"]').first();
  await expect(wikilinkChip).toBeVisible();
  const href = await wikilinkChip.getAttribute("href");
  expect(href).toMatch(/\/admin\/wiki\//);
});

test("wiki back button returns to overview", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/wiki/dashboard");
  await page.getByRole("link", { name: /Zur Übersicht|Back to overview/i }).first().click();
  await expect(page).toHaveURL("/admin/wiki");
});

test("wiki sidebar entry is visible in admin nav", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /Hilfe|Help/i })).toBeVisible();
});

test.describe("unauthorized access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthorized users cannot access wiki", async ({ page }) => {
    await page.goto("/admin/wiki");
    await expect(page).toHaveURL(/signin/);
  });
});
