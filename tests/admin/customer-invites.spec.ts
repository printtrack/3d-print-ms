import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestCustomer, createTestCustomerInvite, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("invite API", () => {
  test("creates an unbound invite", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/invites", { data: { note: "Messekontakt" } });

    expect(res.status()).toBe(201);
    const invite = await res.json();
    expect(invite.email).toBeNull();
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test("creates a bound invite for an email", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/invites", {
      data: { email: "Neu@Example.com" },
    });

    expect(res.status()).toBe(201);
    // Stored normalized so redemption can compare addresses reliably.
    expect((await res.json()).email).toBe("neu@example.com");
  });

  test("refuses an invite for an existing customer", async ({ seed, page }) => {
    void seed;
    await createTestCustomer({ email: "schon@example.com" });

    const res = await page.request.post("/api/admin/invites", {
      data: { email: "schon@example.com" },
    });
    expect(res.status()).toBe(409);
  });

  test("lists and revokes invites", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite({ email: "weg@example.com" });

    const list = await page.request.get("/api/admin/invites");
    expect(list.status()).toBe(200);
    expect((await list.json()).map((i: { token: string }) => i.token)).toContain(invite.token);

    const del = await page.request.delete(`/api/admin/invites/${invite.token}`);
    expect(del.status()).toBe(200);
    expect(await prismaTest.customerInvite.findUnique({ where: { token: invite.token } })).toBeNull();
  });

  test("returns 404 for an unknown invite", async ({ seed, page }) => {
    void seed;
    const res = await page.request.delete("/api/admin/invites/gibtesnicht");
    expect(res.status()).toBe(404);
  });
});

test.describe("permission boundary", () => {
  test("a team member may not manage invites", async ({ seed, browser }) => {
    void seed;
    await createTestUser({ email: "teammitglied@example.com", role: "TEAM_MEMBER" });

    // Fresh context: the storageState above is an ADMIN session.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/auth/signin");
    await page.getByLabel("E-Mail").fill("teammitglied@example.com");
    await page.getByLabel("Passwort").fill("admin123");
    await page.getByRole("button", { name: /Anmelden/i }).click();
    await page.waitForURL("**/admin**");

    const list = await page.request.get("/api/admin/invites");
    expect(list.status()).toBe(403);

    const create = await page.request.post("/api/admin/invites", {
      data: { email: "verboten@example.com" },
    });
    expect(create.status()).toBe(403);

    await context.close();
  });

  test("an anonymous request is unauthorized", async ({ seed, browser }) => {
    void seed;
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await context.request.get("/api/admin/invites");
    expect(res.status()).toBe(401);
    await context.close();
  });
});

test.describe("invite management UI", () => {
  test("creates an invite from the customers page", async ({ seed, page }) => {
    void seed;
    await page.goto("/admin/customers");

    await page.getByRole("button", { name: /Hinzufügen/i }).click();
    await page.getByRole("menuitem", { name: "Einladen" }).click();

    await page.getByLabel("E-Mail (optional)").fill("eingeladen@example.com");
    await page.getByRole("dialog").getByRole("button", { name: "Einladen" }).click();

    await expect(page.getByTestId("invite-row")).toHaveCount(1);
    // Scoped to the row: the success toast repeats the address.
    await expect(page.getByTestId("invite-row").getByText("eingeladen@example.com")).toBeVisible();
    expect(await prismaTest.customerInvite.findFirst({ where: { email: "eingeladen@example.com" } })).not.toBeNull();
  });

  test("revokes an invite from the list", async ({ seed, page }) => {
    void seed;
    const invite = await createTestCustomerInvite({ email: "weg@example.com" });
    page.on("dialog", (d) => d.accept());

    await page.goto("/admin/customers");
    await page.getByRole("button", { name: /Einladung löschen: weg@example.com/i }).click();

    await expect(page.getByTestId("invite-row")).toHaveCount(0);
    expect(await prismaTest.customerInvite.findUnique({ where: { token: invite.token } })).toBeNull();
  });

  test("shows an open invite inline as pending, and hides redeemed ones", async ({ seed, page }) => {
    void seed;
    await createTestCustomerInvite({ email: "wartet@example.com" });
    await createTestCustomerInvite({ email: "erledigt@example.com", usedAt: new Date() });

    await page.goto("/admin/customers");

    const row = page.getByTestId("invite-row");
    await expect(row).toHaveCount(1);
    await expect(row.getByText("wartet@example.com")).toBeVisible();
    await expect(row.getByText("Einladung ausstehend")).toBeVisible();
    await expect(page.getByText("erledigt@example.com")).toHaveCount(0);
  });

  test("hides the invite section when registration is closed", async ({ seed, page }) => {
    void seed;
    await prismaTest.setting.upsert({
      where: { key: "portal_registration_mode" },
      update: { value: "closed" },
      create: { key: "portal_registration_mode", value: "closed" },
    });

    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: "Kunden" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Einladen" })).toHaveCount(0);

    await prismaTest.setting.update({
      where: { key: "portal_registration_mode" },
      data: { value: "open" },
    });
  });
});
