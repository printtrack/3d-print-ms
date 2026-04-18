import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

test.describe("Password reset flow", () => {
  test("sign-in page has 'Passwort vergessen?' link", async ({ seed, page }) => {
    await page.goto("/auth/signin");
    const link = page.getByRole("link", { name: /Passwort vergessen/i });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/auth/reset-password");
  });

  test("reset request page renders", async ({ seed, page }) => {
    await page.goto("/auth/reset-password");
    await expect(page.getByRole("heading", { name: /Passwort zurücksetzen/i })).toBeVisible();
    await expect(page.getByLabel("E-Mail")).toBeVisible();
    await expect(page.getByRole("button", { name: /Reset-Link senden/i })).toBeVisible();
  });

  test("submitting an email shows success message", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await page.getByLabel("E-Mail").fill("nobody@example.com");
    await page.getByRole("button", { name: /Reset-Link senden/i }).click();
    // API always returns success to prevent email enumeration
    await expect(page.getByText(/Reset-Link gesendet|existiert.*wurde.*E-Mail|Bitte prüfen/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("invalid token page shows error message", async ({ page }) => {
    await page.goto("/auth/reset-password/invalid-token-xyz");
    await expect(page.getByText(/ungültig|abgelaufen/i)).toBeVisible();
  });

  test("valid token page shows new password form", async ({ page }) => {
    // Token is created in the test DB; requires server to use the test DB (see MEMORY.md setup)
    const record = await prismaTest.passwordResetToken.create({
      data: {
        email: "admin@3dprinting.local",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      await page.goto(`/auth/reset-password/${record.token}`);
      await expect(page.getByLabel("Neues Passwort")).toBeVisible();
      await expect(page.getByLabel("Passwort bestätigen")).toBeVisible();
      await expect(page.getByRole("button", { name: /Passwort speichern/i })).toBeVisible();
    } finally {
      await prismaTest.passwordResetToken.deleteMany({ where: { id: record.id } });
    }
  });

  test("full reset flow: set new password and redirect to sign-in", async ({ page }) => {
    const record = await prismaTest.passwordResetToken.create({
      data: {
        email: "admin@3dprinting.local",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      await page.goto(`/auth/reset-password/${record.token}`);

      await page.getByLabel("Neues Passwort").fill("newpassword123");
      await page.getByLabel("Passwort bestätigen").fill("newpassword123");
      await page.getByRole("button", { name: /Passwort speichern/i }).click();

      // Should redirect to sign-in after success
      await page.waitForURL("**/auth/signin", { timeout: 10000 });

      // Restore original admin password
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash("admin123", 12);
      await prismaTest.user.update({
        where: { email: "admin@3dprinting.local" },
        data: { password: hashed },
      });
    } finally {
      await prismaTest.passwordResetToken.deleteMany({ where: { id: record.id } }).catch(() => {});
    }
  });
});
