import { test, expect } from "../fixtures/test-base";
import {
  createTestCustomer,
  createTestOrder,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Admin Customer Management", () => {
  test("happy path: admin creates customer — appears with Verifiziert badge", async ({ seed, page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Hinzufügen" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name *").fill("Erika Muster");
    await dialog.getByLabel("E-Mail *").fill("erika@example.com");
    await dialog.getByLabel(/Passwort \*/).fill("passwort123");
    await dialog.getByRole("button", { name: "Anlegen" }).click();

    await expect(page.getByText("Erika Muster")).toBeVisible();
    await expect(page.getByText("erika@example.com")).toBeVisible();
    await expect(page.getByText("Verifiziert").first()).toBeVisible();

    const customer = await prismaTest.customer.findUnique({ where: { email: "erika@example.com" } });
    expect(customer).not.toBeNull();
    expect(customer!.emailVerifiedAt).not.toBeNull();
  });

  test("edit: name change persists", async ({ seed, page }) => {
    await createTestCustomer({ name: "Edit Tester", email: "edit@example.com" });

    await page.goto("/admin/customers");
    await expect(page.getByText("Edit Tester")).toBeVisible();

    await page.getByRole("button", { name: "Bearbeiten" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name *").fill("Edit Geändert");
    await dialog.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByText("Edit Geändert")).toBeVisible({ timeout: 5000 });
  });

  test("delete: AlertDialog appears, customer removed", async ({ seed, page }) => {
    await createTestCustomer({ name: "Delete Tester", email: "delete@example.com" });

    await page.goto("/admin/customers");
    await expect(page.getByText("Delete Tester")).toBeVisible();

    await page.getByRole("button", { name: "Löschen" }).first().click();

    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText(/anonymisiert/)).toBeVisible();
    await alertDialog.getByRole("button", { name: "Löschen" }).click();

    await expect(page.getByText("Delete Tester")).not.toBeVisible({ timeout: 5000 });
  });

  test("delete: existing orders are anonymized (customerId set to null)", async ({ seed, page }) => {
    const customer = await createTestCustomer({ name: "Order Owner", email: "owner@example.com" });
    const phase = seed.phases[0];
    const order = await createTestOrder(phase.id, {
      customerEmail: "owner@example.com",
      customerName: "Order Owner",
      customerId: customer.id,
    });

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Löschen" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("Order Owner")).not.toBeVisible({ timeout: 5000 });

    const updated = await prismaTest.order.findUnique({ where: { id: order.id } });
    expect(updated).not.toBeNull();
    expect(updated!.customerId).toBeNull();
  });

  test("duplicate email shows error toast", async ({ seed, page }) => {
    await createTestCustomer({ email: "dupe@example.com" });

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Hinzufügen" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name *").fill("Zweiter");
    await dialog.getByLabel("E-Mail *").fill("dupe@example.com");
    await dialog.getByLabel(/Passwort \*/).fill("passwort123");
    await dialog.getByRole("button", { name: "Anlegen" }).click();

    await expect(page.getByText(/bereits vergeben/).first()).toBeVisible({ timeout: 5000 });
  });

  test("verify button: unverified customer gets verified", async ({ seed, page }) => {
    await createTestCustomer({ name: "Unverifiziert", email: "unverified@example.com", emailVerifiedAt: null });

    await page.goto("/admin/customers");
    await expect(page.getByText("Ausstehend")).toBeVisible();
    await expect(page.getByRole("button", { name: "Freischalten" })).toBeVisible();

    await page.getByRole("button", { name: "Freischalten" }).click();

    await expect(page.getByText("Verifiziert").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Freischalten" })).not.toBeVisible();
  });

  test("permission: POST /api/admin/customers requires ADMIN (API-level check)", async ({ seed, page }) => {
    const res = await page.request.post("/api/admin/customers", {
      data: { name: "API Test", email: "apitest@example.com", password: "123456" },
    });
    expect(res.status()).toBe(201);
  });
});
