import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// Helper: reset onboardedAt so tutorial auto-starts
async function clearOnboarded() {
  await prismaTest.user.update({
    where: { id: "test-admin-user-fixed-id" },
    data: { onboardedAt: null },
  });
}

test("tutorial auto-starts on first login and shows welcome dialog", async ({ seed, page }) => {
  await clearOnboarded();
  await page.goto("/admin");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Willkommen bei PrintTrack")).toBeVisible();
  // Story content: Atommodell use case
  await expect(page.getByText("Dr. Weber")).toBeVisible();
  await expect(page.getByText(/Elektronen/i).first()).toBeVisible();
});

test("skip: clicking Überspringen closes tutorial and marks onboarded", async ({ seed, page }) => {
  await clearOnboarded();
  await page.goto("/admin");
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Überspringen" }).click();

  // Dialog should be gone
  await expect(page.getByText("Willkommen bei PrintTrack")).not.toBeVisible({ timeout: 3000 });

  // Give the async PATCH time to complete
  await page.waitForTimeout(1000);

  // onboardedAt should now be set
  const user = await prismaTest.user.findUnique({
    where: { id: "test-admin-user-fixed-id" },
    select: { onboardedAt: true },
  });
  expect(user?.onboardedAt).not.toBeNull();
});

test("no auto-start after tutorial completed", async ({ seed, page }) => {
  // Admin has onboardedAt set (from seedDb default)
  await page.goto("/admin");
  await expect(page.getByText("Willkommen bei PrintTrack")).not.toBeVisible();
});

test("re-launch: sidebar button triggers welcome dialog", async ({ seed, page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Tutorial starten" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Willkommen bei PrintTrack")).toBeVisible();
});

test("tutorial shows mock order on kanban page", async ({ seed, page }) => {
  await clearOnboarded();
  await page.goto("/admin/orders?tutorial=1");

  // Reload to trigger welcome dialog
  await clearOnboarded();
  await page.reload();

  // Start tutorial via welcome dialog
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Tutorial starten" }).click();

  // Mock order card (Atommodell use case) should be visible on the kanban
  await expect(page.getByText("Dr. M. Weber").first()).toBeVisible({ timeout: 5000 });
});

test("DB isolation: tutorial actions do not create real orders", async ({ seed, page }) => {
  await clearOnboarded();
  await page.goto("/admin");

  // Start tutorial then skip
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Überspringen" }).click();

  // Check no tutorial data leaked to DB
  const orderCount = await prismaTest.order.count();
  const jobCount = await prismaTest.printJob.count();
  expect(orderCount).toBe(0);
  expect(jobCount).toBe(0);
});

test("tutorial order detail renders mock data without DB error", async ({ seed, page }) => {
  // Navigate directly to the tutorial order detail page
  await page.goto("/admin/orders/tutorial-order-1");

  // Should see Atommodell mock order content
  await expect(page.getByText("Dr. M. Weber").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Elektronen-Träger/i)).toBeVisible();
});

test("i18n: tutorial uses EN locale when language is set to EN", async ({ seed, page }) => {
  await clearOnboarded();

  // Set locale to EN
  await page.context().addCookies([{ name: "locale", value: "en", domain: "localhost", path: "/" }]);
  await page.goto("/admin");
  await expect(page.getByText("Welcome to PrintTrack")).toBeVisible({ timeout: 5000 });
});
