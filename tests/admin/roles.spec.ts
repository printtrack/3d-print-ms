import { test, expect, loginAs } from "../fixtures/test-base";
import { createTestUser, createTestTeamRole, prismaTest } from "../fixtures/db";
import { SYSTEM_ROLE_ID } from "../../lib/permissions";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("roles API", () => {
  test("admin creates a role with a chosen permission set", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/roles", {
      data: {
        name: "Schüler",
        description: "Darf nur die eigenen Aufträge bearbeiten.",
        restricted: true,
        permissions: ["orders.edit", "jobs.manage"],
      },
    });
    expect(res.status()).toBe(201);

    const role = await res.json();
    expect(role.name).toBe("Schüler");
    expect(role.restricted).toBe(true);
    expect(role.permissions.map((p: { key: string }) => p.key).sort()).toEqual([
      "jobs.manage",
      "orders.edit",
    ]);
    expect(role._count.users).toBe(0);
  });

  test("lists roles including the seeded default", async ({ seed, page }) => {
    void seed;
    const res = await page.request.get("/api/admin/roles");
    expect(res.status()).toBe(200);

    const roles = await res.json();
    const system = roles.find((r: { id: string }) => r.id === SYSTEM_ROLE_ID);
    expect(system).toBeTruthy();
    expect(system.isSystem).toBe(true);
  });

  test("editing replaces the permission set wholesale", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({
      name: "Betreuer",
      permissions: ["orders.edit", "orders.delete"],
    });

    const res = await page.request.patch(`/api/admin/roles/${role.id}`, {
      data: { permissions: ["orders.edit"], restricted: true },
    });
    expect(res.status()).toBe(200);

    const updated = await res.json();
    expect(updated.permissions.map((p: { key: string }) => p.key)).toEqual(["orders.edit"]);
    expect(updated.restricted).toBe(true);
  });

  test("a role can be stripped of every permission", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ permissions: ["orders.edit"] });

    const res = await page.request.patch(`/api/admin/roles/${role.id}`, {
      data: { permissions: [] },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).permissions).toEqual([]);
  });

  test("an unknown permission key is rejected", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/roles", {
      data: { name: "Kaputt", permissions: ["orders.destroy_everything"] },
    });
    expect(res.status()).toBe(400);
  });

  test("a duplicate role name is rejected", async ({ seed, page }) => {
    void seed;
    await createTestTeamRole({ name: "Doppelt" });
    const res = await page.request.post("/api/admin/roles", {
      data: { name: "Doppelt" },
    });
    expect(res.status()).toBe(409);
  });

  test("deleting a role that still has members is refused", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ name: "In Benutzung" });
    await createTestUser({ email: "member@example.com", teamRoleId: role.id });

    const res = await page.request.delete(`/api/admin/roles/${role.id}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).memberCount).toBe(1);

    // still there
    expect(await prismaTest.teamRole.count({ where: { id: role.id } })).toBe(1);
  });

  test("the system default role cannot be deleted", async ({ seed, page }) => {
    void seed;
    const res = await page.request.delete(`/api/admin/roles/${SYSTEM_ROLE_ID}`);
    expect(res.status()).toBe(409);
  });

  test("an unused role is deleted", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ name: "Ungenutzt" });
    const res = await page.request.delete(`/api/admin/roles/${role.id}`);
    expect(res.status()).toBe(200);
    expect(await prismaTest.teamRole.count({ where: { id: role.id } })).toBe(0);
  });
});

test.describe("roles permission boundary", () => {
  test("a team member may not read or manage roles", async ({ seed, browser }) => {
    void seed;
    await createTestUser({ email: "teammitglied@example.com" });
    const { context, page } = await loginAs(browser, "teammitglied@example.com");

    expect((await page.request.get("/api/admin/roles")).status()).toBe(403);
    expect(
      (await page.request.post("/api/admin/roles", { data: { name: "Hack" } })).status(),
    ).toBe(403);

    await context.close();
  });

  test("a member cannot grant themselves permissions via the roles API", async ({
    seed,
    browser,
  }) => {
    void seed;
    // Roles are hard-wired to ADMIN precisely so this cannot work: a member with
    // a "manage roles" right could otherwise tick every other right for himself.
    const role = await createTestTeamRole({ name: "Eskalation", permissions: [] });
    await createTestUser({ email: "eskalation@example.com", teamRoleId: role.id });
    const { context, page } = await loginAs(browser, "eskalation@example.com");

    const res = await page.request.patch(`/api/admin/roles/${role.id}`, {
      data: { permissions: ["orders.delete"] },
    });
    expect(res.status()).toBe(403);

    const after = await prismaTest.teamRolePermission.count({ where: { roleId: role.id } });
    expect(after).toBe(0);

    await context.close();
  });

  test("an anonymous request is unauthorized", async ({ seed, browser }) => {
    void seed;
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    expect((await context.request.get("/api/admin/roles")).status()).toBe(401);
    await context.close();
  });
});
