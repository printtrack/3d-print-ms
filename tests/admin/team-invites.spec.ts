import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestUser, createTestTeamInvite } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("team invite API", () => {
  test("creates an unbound team invite", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/team/invites", {
      data: { note: "Werkstudent" },
    });

    expect(res.status()).toBe(201);
    const invite = await res.json();
    expect(invite.email).toBeNull();
    expect(invite.role).toBe("TEAM_MEMBER");
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test("creates a bound admin invite with normalized email", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/team/invites", {
      data: { email: "Neu@Example.com", role: "ADMIN" },
    });

    expect(res.status()).toBe(201);
    const invite = await res.json();
    expect(invite.email).toBe("neu@example.com");
    expect(invite.role).toBe("ADMIN");
    // Admins bypass permissions — no team role is stored.
    expect(invite.teamRoleId).toBeNull();
  });

  test("refuses an invite for an existing team member", async ({ seed, page }) => {
    void seed;
    await createTestUser({ email: "schon@example.com", role: "TEAM_MEMBER" });

    const res = await page.request.post("/api/admin/team/invites", {
      data: { email: "schon@example.com" },
    });
    expect(res.status()).toBe(409);
  });

  test("lists and revokes team invites", async ({ seed, page }) => {
    void seed;
    const invite = await createTestTeamInvite({ email: "weg@example.com" });

    const list = await page.request.get("/api/admin/team/invites");
    expect(list.status()).toBe(200);
    expect((await list.json()).map((i: { token: string }) => i.token)).toContain(invite.token);

    const del = await page.request.delete(`/api/admin/team/invites/${invite.token}`);
    expect(del.status()).toBe(200);
    expect(await prismaTest.teamInvite.findUnique({ where: { token: invite.token } })).toBeNull();
  });

  test("returns 404 for an unknown invite", async ({ seed, page }) => {
    void seed;
    const res = await page.request.delete("/api/admin/team/invites/gibtesnicht");
    expect(res.status()).toBe(404);
  });
});

test.describe("team invite redemption", () => {
  test("redeems a bound invite and creates the member", async ({ seed, browser }) => {
    void seed;
    const invite = await createTestTeamInvite({ email: "neu@example.com", role: "TEAM_MEMBER" });

    // Redemption is public — use an anonymous context, not the admin session.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await context.request.post(`/api/team-invites/${invite.token}/accept`, {
      data: { name: "Neue Kollegin", password: "geheim123" },
    });
    expect(res.status()).toBe(200);

    const user = await prismaTest.user.findUnique({ where: { email: "neu@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("TEAM_MEMBER");
    // Fell back to the seeded default team role.
    expect(user!.teamRoleId).not.toBeNull();

    const used = await prismaTest.teamInvite.findUnique({ where: { token: invite.token } });
    expect(used!.usedAt).not.toBeNull();
    expect(used!.usedById).toBe(user!.id);

    await context.close();
  });

  test("rejects a second redemption of the same invite", async ({ seed, browser }) => {
    void seed;
    const invite = await createTestTeamInvite({ email: "einmal@example.com" });
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });

    const first = await context.request.post(`/api/team-invites/${invite.token}/accept`, {
      data: { name: "Erste", password: "geheim123" },
    });
    expect(first.status()).toBe(200);

    const second = await context.request.post(`/api/team-invites/${invite.token}/accept`, {
      data: { name: "Zweite", password: "geheim123" },
    });
    expect(second.status()).toBe(400);
    await context.close();
  });

  test("rejects an expired invite", async ({ seed, browser }) => {
    void seed;
    const invite = await createTestTeamInvite({
      email: "spaet@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await context.request.post(`/api/team-invites/${invite.token}/accept`, {
      data: { name: "Zu spät", password: "geheim123" },
    });
    expect(res.status()).toBe(400);
    await context.close();
  });
});

test.describe("permission boundary", () => {
  test("a team member may not manage team invites", async ({ seed, browser }) => {
    void seed;
    await createTestUser({ email: "teammitglied@example.com", role: "TEAM_MEMBER" });

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/auth/signin");
    await page.getByLabel("E-Mail").fill("teammitglied@example.com");
    await page.getByLabel("Passwort").fill("admin123");
    await page.getByRole("button", { name: /Anmelden/i }).click();
    await page.waitForURL("**/admin**");

    const list = await page.request.get("/api/admin/team/invites");
    expect(list.status()).toBe(403);

    const create = await page.request.post("/api/admin/team/invites", {
      data: { email: "verboten@example.com" },
    });
    expect(create.status()).toBe(403);

    await context.close();
  });

  test("an anonymous request is unauthorized", async ({ seed, browser }) => {
    void seed;
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await context.request.get("/api/admin/team/invites");
    expect(res.status()).toBe(401);
    await context.close();
  });
});

test.describe("team invite UI", () => {
  test("creates a team invite from the add menu", async ({ seed, page }) => {
    void seed;
    await page.goto("/admin/team");

    await page.getByRole("button", { name: /Hinzufügen/i }).click();
    await page.getByRole("menuitem", { name: "Einladen" }).click();

    await page.getByLabel("E-Mail (optional)").fill("eingeladen@example.com");
    // Scope to the dialog — the confirm button shares its label with the menu item.
    await page.getByRole("dialog").getByRole("button", { name: "Einladen" }).click();

    await expect(page.getByTestId("team-invite-row")).toHaveCount(1);
    await expect(
      page.getByTestId("team-invite-row").getByText("eingeladen@example.com")
    ).toBeVisible();
    expect(
      await prismaTest.teamInvite.findFirst({ where: { email: "eingeladen@example.com" } })
    ).not.toBeNull();
  });

  test("revokes a team invite from the list", async ({ seed, page }) => {
    void seed;
    const invite = await createTestTeamInvite({ email: "weg@example.com" });
    page.on("dialog", (d) => d.accept());

    await page.goto("/admin/team");
    await page.getByRole("button", { name: /Einladung löschen: weg@example.com/i }).click();

    await expect(page.getByTestId("team-invite-row")).toHaveCount(0);
    expect(await prismaTest.teamInvite.findUnique({ where: { token: invite.token } })).toBeNull();
  });

  test("shows an open invite inline as pending, and hides redeemed ones", async ({ seed, page }) => {
    void seed;
    await createTestTeamInvite({ email: "wartet@example.com" });
    await createTestTeamInvite({ email: "erledigt@example.com", usedAt: new Date() });

    await page.goto("/admin/team");

    // Open invite → one pending card in the member list.
    const row = page.getByTestId("team-invite-row");
    await expect(row).toHaveCount(1);
    await expect(row.getByText("wartet@example.com")).toBeVisible();
    await expect(row.getByText("Einladung ausstehend")).toBeVisible();
    // Redeemed invite is not shown — that person would be a member instead.
    await expect(page.getByText("erledigt@example.com")).toHaveCount(0);
  });

  test("a redeemed member can sign in through the accept page", async ({ seed, page }) => {
    void seed;
    const invite = await createTestTeamInvite({ email: "flow@example.com" });

    await page.goto(`/auth/accept-invite?token=${invite.token}`);
    await page.getByLabel(/Name/i).fill("Flow Kollege");
    await page.getByLabel("Passwort", { exact: true }).fill("geheim123");
    await page.getByLabel(/Passwort bestätigen/i).fill("geheim123");
    await page.getByRole("button", { name: /Konto erstellen/i }).click();

    // Redirected to sign-in with the email prefilled.
    await page.waitForURL("**/auth/signin**");
    await page.getByLabel("Passwort").fill("geheim123");
    await page.getByRole("button", { name: /Anmelden/i }).click();
    await page.waitForURL("**/admin**");
  });
});
