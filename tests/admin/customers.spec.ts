import { test, expect } from "../fixtures/test-base";
import { createTestCustomer, createTestCreditTransaction } from "../fixtures/db";

test.describe("Customer credit management", () => {
  test("shows customer list", async ({ seed, page }) => {
    await createTestCustomer({ name: "Anna Müller", email: "anna@example.com" });

    await page.goto("/admin/customers");
    await expect(page.getByText("Anna Müller")).toBeVisible();
    await expect(page.getByText("anna@example.com")).toBeVisible();
  });

  test("shows balance badge for customer", async ({ seed, page }) => {
    await createTestCustomer({ email: "balance@example.com" });

    await page.goto("/admin/customers");
    await expect(page.getByText("0 g")).toBeVisible();
  });

  test("can top up credits for a customer", async ({ seed, page }) => {
    await createTestCustomer({ name: "Karl Kredit", email: "karl@example.com" });

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Guthaben" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder("z.B. 100").fill("250");
    await page.getByPlaceholder("z.B. Guthaben-Kauf, Abzug für Auftrag...").fill("Guthaben-Kauf 250g");

    await page.getByRole("button", { name: /^Buchen$/ }).click();

    await expect(dialog.getByText("250 g")).toBeVisible({ timeout: 5000 });
  });

  test("can deduct credits from a customer", async ({ seed, page }) => {
    const customer = await createTestCustomer({ name: "Deduct Tester", email: "deduct@example.com" });
    await createTestCreditTransaction(customer.id, 500, "Initial top-up");

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Guthaben" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Abziehen" }).click();

    await page.getByPlaceholder("z.B. 100").fill("100");
    await page.getByPlaceholder("z.B. Guthaben-Kauf, Abzug für Auftrag...").fill("Abzug für Druck");

    await page.getByRole("button", { name: /^Buchen$/ }).click();

    await expect(dialog.getByText("400 g")).toBeVisible({ timeout: 5000 });
  });

  test("shows transaction history on request", async ({ seed, page }) => {
    const customer = await createTestCustomer({ name: "History Tester", email: "history@example.com" });
    await createTestCreditTransaction(customer.id, 300, "Erstes Guthaben");

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Guthaben" }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Verlauf anzeigen/ }).click();

    await expect(page.getByText("Erstes Guthaben")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("+300 g")).toBeVisible();
  });

  test("shows empty state when no customers", async ({ seed, page }) => {
    await page.goto("/admin/customers");
    await expect(page.getByText("Keine Kundenkonten")).toBeVisible();
  });

  test("customers page is accessible to admin", async ({ seed, page }) => {
    await page.goto("/admin/customers");
    await expect(page).toHaveURL("/admin/customers");
    await expect(page.getByRole("heading", { name: "Kunden" })).toBeVisible();
  });
});
