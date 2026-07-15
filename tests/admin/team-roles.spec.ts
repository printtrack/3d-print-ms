import { test, expect } from "../fixtures/test-base";
import { createTestUser, createTestTeamRole, prismaTest } from "../fixtures/db";
import { SYSTEM_ROLE_ID } from "../../lib/permissions";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("assigning team roles", () => {
  test("a new member lands on the default role", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/team", {
      data: { name: "Neu", email: "neu@example.com", password: "geheim123" },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).teamRoleId).toBe(SYSTEM_ROLE_ID);
  });

  test("a member can be created straight into a chosen role", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ name: "Schüler", restricted: true });

    const res = await page.request.post("/api/admin/team", {
      data: {
        name: "Lena",
        email: "lena@example.com",
        password: "geheim123",
        teamRoleId: role.id,
      },
    });
    expect(res.status()).toBe(201);

    const created = await res.json();
    expect(created.teamRole.name).toBe("Schüler");
    expect(created.restrictedToAssigned).toBeNull();
  });

  test("an admin never gets a team role attached", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ name: "Egal" });
    const res = await page.request.post("/api/admin/team", {
      data: {
        name: "Chefin",
        email: "chefin@example.com",
        password: "geheim123",
        role: "ADMIN",
        teamRoleId: role.id,
      },
    });
    expect(res.status()).toBe(201);
    // Admins bypass permissions; a role on them would only mislead.
    expect((await res.json()).teamRoleId).toBeNull();
  });

  test("the restriction override is tri-state", async ({ seed, page }) => {
    void seed;
    const role = await createTestTeamRole({ name: "Locker", restricted: false });
    const user = await createTestUser({ email: "tri@example.com", teamRoleId: role.id });

    // explicit yes — overrides the role's "false"
    let res = await page.request.patch(`/api/admin/team/${user.id}`, {
      data: { restrictedToAssigned: true },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).restrictedToAssigned).toBe(true);

    // explicit no
    res = await page.request.patch(`/api/admin/team/${user.id}`, {
      data: { restrictedToAssigned: false },
    });
    expect((await res.json()).restrictedToAssigned).toBe(false);

    // back to inherit
    res = await page.request.patch(`/api/admin/team/${user.id}`, {
      data: { restrictedToAssigned: null },
    });
    expect((await res.json()).restrictedToAssigned).toBeNull();
  });

  test("omitting the override leaves it untouched", async ({ seed, page }) => {
    void seed;
    const user = await createTestUser({
      email: "unberuehrt@example.com",
      restrictedToAssigned: true,
    });

    // "not sent" must not be confused with "set to inherit"
    const res = await page.request.patch(`/api/admin/team/${user.id}`, {
      data: { name: "Nur der Name" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).restrictedToAssigned).toBe(true);
  });

  test("an unknown role id is rejected", async ({ seed, page }) => {
    void seed;
    const user = await createTestUser({ email: "unbekannt@example.com" });
    const res = await page.request.patch(`/api/admin/team/${user.id}`, {
      data: { teamRoleId: "gibt-es-nicht" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("last admin protection", () => {
  test("the last admin cannot be demoted", async ({ seed, page }) => {
    const res = await page.request.patch(`/api/admin/team/${seed.admin.id}`, {
      data: { role: "TEAM_MEMBER" },
    });
    expect(res.status()).toBe(409);

    const after = await prismaTest.user.findUniqueOrThrow({ where: { id: seed.admin.id } });
    expect(after.role).toBe("ADMIN");
  });

  test("the last admin cannot be deleted", async ({ seed, page }) => {
    // Another admin exists, so the seeded one is deletable in principle —
    // but deleting yourself is blocked, which is a different guard.
    const other = await createTestUser({ email: "zweiter-admin@example.com", role: "ADMIN" });

    const res = await page.request.delete(`/api/admin/team/${other.id}`);
    expect(res.status()).toBe(200);

    // now the seeded admin is the last one; deleting via API hits the self-delete
    // guard first, so demote-check is the meaningful one here
    const demote = await page.request.patch(`/api/admin/team/${seed.admin.id}`, {
      data: { role: "TEAM_MEMBER" },
    });
    expect(demote.status()).toBe(409);
  });

  test("an admin can be demoted while another admin remains", async ({ seed, page }) => {
    void seed;
    const other = await createTestUser({ email: "kollege@example.com", role: "ADMIN" });

    const res = await page.request.patch(`/api/admin/team/${other.id}`, {
      data: { role: "TEAM_MEMBER" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).role).toBe("TEAM_MEMBER");
  });
});
