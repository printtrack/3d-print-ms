import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";
import bcrypt from "bcryptjs";

test.describe("Team management", () => {
  test("shows the admin user", async ({ seed, page }) => {
    await page.goto("/admin/team");
    await expect(page.getByText("admin@3dprinting.local")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Admin$/ })).toBeVisible();
  });

  test("can invite a new team member", async ({ seed, page }) => {
    await page.goto("/admin/team");

    await page.getByRole("button", { name: /Hinzufügen/i }).click();

    await page.getByPlaceholder("Max Mustermann").fill("New Team Member");
    await page.getByPlaceholder("max@example.com").fill("newmember@example.com");
    await page.getByPlaceholder("Mindestens 6 Zeichen").fill("password123");

    await page.getByRole("button", { name: /^Erstellen$/ }).click();

    await expect(page.getByText("newmember@example.com")).toBeVisible({ timeout: 5000 });
  });

  test("can remove a team member", async ({ seed, page }) => {
    const hashed = await bcrypt.hash("test123", 10);
    await prismaTest.user.create({
      data: {
        name: "To Delete Member",
        email: "todelete@example.com",
        password: hashed,
        role: "TEAM_MEMBER",
      },
    });

    await page.goto("/admin/team");
    await expect(page.getByText("todelete@example.com")).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    const memberCard = page.locator('[data-slot="card-content"]').filter({
      hasText: "todelete@example.com",
    });
    await memberCard.getByRole("button").last().click();

    await expect(page.getByText("todelete@example.com")).not.toBeVisible({ timeout: 5000 });
  });

  test("shows role badge for admin", async ({ seed, page }) => {
    await page.goto("/admin/team");
    await expect(page.locator("span").filter({ hasText: /^Admin$/ }).first()).toBeVisible();
  });

  test("can edit a team member name and email", async ({ seed, page }) => {
    const hashed = await bcrypt.hash("test123", 10);
    await prismaTest.user.create({
      data: {
        name: "Edit Me",
        email: "editme@example.com",
        password: hashed,
        role: "TEAM_MEMBER",
      },
    });

    await page.goto("/admin/team");
    await expect(page.getByText("editme@example.com")).toBeVisible();

    const memberCard = page.locator('[data-slot="card-content"]').filter({
      hasText: "editme@example.com",
    });
    await memberCard.getByRole("button").first().click();

    const nameInput = page.getByPlaceholder("Max Mustermann");
    await nameInput.clear();
    await nameInput.fill("Edited Name");

    const emailInput = page.getByPlaceholder("max@example.com");
    await emailInput.clear();
    await emailInput.fill("edited@example.com");

    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(page.getByText("edited@example.com")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("editme@example.com")).not.toBeVisible();
  });

  test("can change a team member role via edit dialog", async ({ seed, page }) => {
    const hashed = await bcrypt.hash("test123", 10);
    await prismaTest.user.create({
      data: {
        name: "Role Change",
        email: "rolechange@example.com",
        password: hashed,
        role: "TEAM_MEMBER",
      },
    });

    await page.goto("/admin/team");
    await expect(page.getByText("rolechange@example.com")).toBeVisible();

    const memberCard = page.locator('[data-slot="card-content"]').filter({
      hasText: "rolechange@example.com",
    });
    await memberCard.getByRole("button").first().click();

    await page.locator('[data-slot="dialog-content"]').getByRole("combobox").click();
    await page.getByRole("option", { name: "Admin" }).click();

    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(
      page.locator('[data-slot="card-content"]')
        .filter({ hasText: "rolechange@example.com" })
        .getByText("Admin")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows error when editing with duplicate email", async ({ seed, page }) => {
    const hashed = await bcrypt.hash("test123", 10);
    await prismaTest.user.create({
      data: {
        name: "Dupe Test",
        email: "dupetest@example.com",
        password: hashed,
        role: "TEAM_MEMBER",
      },
    });

    await page.goto("/admin/team");

    const memberCard = page.locator('[data-slot="card-content"]').filter({
      hasText: "dupetest@example.com",
    });
    await memberCard.getByRole("button").first().click();

    const emailInput = page.getByPlaceholder("max@example.com");
    await emailInput.clear();
    await emailInput.fill("admin@3dprinting.local");

    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(page.getByText(/E-Mail bereits vergeben/i).first()).toBeVisible({ timeout: 5000 });
  });
});
