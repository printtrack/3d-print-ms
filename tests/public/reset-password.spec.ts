import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestCustomer } from "../fixtures/db";
import bcrypt from "bcryptjs";

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
        kind: "USER",
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
        kind: "USER",
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
      const hashed = await bcrypt.hash("admin123", 12);
      await prismaTest.user.update({
        where: { email: "admin@3dprinting.local" },
        data: { password: hashed },
      });
    } finally {
      await prismaTest.passwordResetToken.deleteMany({ where: { id: record.id } }).catch(() => {});
    }
  });

  test("cross-flow: CUSTOMER token rejected at admin endpoint, admin password unchanged", async ({ seed, page }) => {
    // Customer and Admin share the same email — worst-case for the bug.
    const sharedEmail = "shared@example.com";
    const adminOriginalHash = await bcrypt.hash("originaladminpw", 12);
    await prismaTest.user.update({
      where: { email: "admin@3dprinting.local" },
      data: { email: sharedEmail, password: adminOriginalHash },
    });
    await createTestCustomer({ email: sharedEmail });

    const customerToken = await prismaTest.passwordResetToken.create({
      data: {
        email: sharedEmail,
        kind: "CUSTOMER",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const res = await page.request.post(`/api/auth/reset-password/${customerToken.token}`, {
        data: { password: "attackerpassword" },
      });
      expect(res.status()).toBe(400);

      // Admin password must remain the original
      const admin = await prismaTest.user.findUnique({ where: { email: sharedEmail } });
      expect(admin).not.toBeNull();
      const stillMatches = await bcrypt.compare("originaladminpw", admin!.password);
      expect(stillMatches).toBe(true);

      // Customer token must NOT have been consumed — still usable at its own endpoint
      const tokenStillExists = await prismaTest.passwordResetToken.findUnique({
        where: { token: customerToken.token },
      });
      expect(tokenStillExists).not.toBeNull();
    } finally {
      // Restore admin email so subsequent tests see the seeded state
      await prismaTest.user.update({
        where: { email: sharedEmail },
        data: { email: "admin@3dprinting.local" },
      }).catch(() => {});
    }
  });

  test("cross-flow: USER token rejected at customer endpoint, customer password unchanged", async ({ seed, page }) => {
    const sharedEmail = "shared2@example.com";
    const customerOriginalPw = "originalcustomerpw";
    const customer = await createTestCustomer({ email: sharedEmail, password: customerOriginalPw });
    // Also create an admin User with the same email
    const adminHash = await bcrypt.hash("adminpw", 12);
    await prismaTest.user.create({
      data: {
        name: "Shared Admin",
        email: sharedEmail,
        password: adminHash,
        role: "TEAM_MEMBER",
      },
    });

    const adminToken = await prismaTest.passwordResetToken.create({
      data: {
        email: sharedEmail,
        kind: "USER",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const res = await page.request.post(`/api/portal/auth/reset-password/${adminToken.token}`, {
        data: { password: "attackerpassword" },
      });
      expect(res.status()).toBe(400);

      // Customer password must remain the original
      const updated = await prismaTest.customer.findUnique({ where: { id: customer.id } });
      expect(updated).not.toBeNull();
      const stillMatches = await bcrypt.compare(customerOriginalPw, updated!.password);
      expect(stillMatches).toBe(true);

      // Admin token must NOT have been consumed
      const tokenStillExists = await prismaTest.passwordResetToken.findUnique({
        where: { token: adminToken.token },
      });
      expect(tokenStillExists).not.toBeNull();
    } finally {
      await prismaTest.user.deleteMany({ where: { email: sharedEmail } }).catch(() => {});
    }
  });
});
