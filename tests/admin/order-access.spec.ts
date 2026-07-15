import { test, expect, loginAs } from "../fixtures/test-base";
import {
  createTestOrder,
  createTestUser,
  createTestTeamRole,
  prismaTest,
} from "../fixtures/db";

// The heart of the feature: a restricted member may work on their own orders and
// nothing else, while still being able to *see* everything.

async function assign(orderId: string, userId: string) {
  await prismaTest.orderAssignee.create({ data: { orderId, userId } });
}

test.describe("assignment lock", () => {
  test("restricted member may edit an order they are assigned to", async ({ seed, browser }) => {
    const role = await createTestTeamRole({
      name: "Schüler",
      restricted: true,
      permissions: ["orders.edit"],
    });
    const user = await createTestUser({ email: "schueler@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);
    await assign(order.id, user.id);

    const { context, page } = await loginAs(browser, "schueler@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });

  test("restricted member may not edit somebody else's order", async ({ seed, browser }) => {
    const role = await createTestTeamRole({
      name: "Schüler",
      restricted: true,
      permissions: ["orders.edit"],
    });
    await createTestUser({ email: "schueler@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "schueler@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_NOT_ASSIGNED");
    await context.close();
  });

  test("restricted member may still READ an order they are not assigned to", async ({
    seed,
    browser,
  }) => {
    // The whole point of "Bearbeiten sperren, Lesen erlaubt".
    const role = await createTestTeamRole({ restricted: true, permissions: ["orders.edit"] });
    await createTestUser({ email: "schueler@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "schueler@example.com");
    expect((await page.request.get(`/api/admin/orders/${order.id}`)).status()).toBe(200);

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText(order.customerName).first()).toBeVisible();
    await context.close();
  });

  test("unrestricted member may edit any order", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ restricted: false, permissions: ["orders.edit"] });
    await createTestUser({ email: "betreuer@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "betreuer@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });

  test("a per-member override beats the role default", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ restricted: true, permissions: ["orders.edit"] });
    await createTestUser({
      email: "ausnahme@example.com",
      teamRoleId: role.id,
      restrictedToAssigned: false, // explicitly unrestricted despite the role
    });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "ausnahme@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });

  test("being assigned to a single part unlocks the order", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ restricted: true, permissions: ["orders.edit"] });
    const user = await createTestUser({ email: "teil@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);
    const part = await prismaTest.orderPart.create({
      data: { orderId: order.id, name: "Halterung", partPhaseId: seed.partPhases[0].id },
    });
    await prismaTest.orderPartAssignee.create({
      data: { orderPartId: part.id, userId: user.id },
    });

    const { context, page } = await loginAs(browser, "teil@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });

  test("admin with an empty role bypasses everything", async ({ seed, browser }) => {
    // The lockout guarantee: a misconfigured role can never trap an admin.
    const role = await createTestTeamRole({ restricted: true, permissions: [] });
    await createTestUser({
      email: "chef@example.com",
      role: "ADMIN",
      teamRoleId: role.id,
      restrictedToAssigned: true,
    });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "chef@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[1].id },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });
});

test.describe("permission boundaries", () => {
  test("without orders.delete the order survives — even when assigned", async ({
    seed,
    browser,
  }) => {
    const role = await createTestTeamRole({ permissions: ["orders.edit"] });
    const user = await createTestUser({ email: "kein-loeschen@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);
    await assign(order.id, user.id);

    const { context, page } = await loginAs(browser, "kein-loeschen@example.com");
    const res = await page.request.delete(`/api/admin/orders/${order.id}`);
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_PERMISSION");

    expect(await prismaTest.order.count({ where: { id: order.id } })).toBe(1);
    await context.close();
  });

  test("with orders.delete granted the order goes", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ permissions: ["orders.edit", "orders.delete"] });
    await createTestUser({ email: "darf-loeschen@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "darf-loeschen@example.com");
    expect((await page.request.delete(`/api/admin/orders/${order.id}`)).status()).toBe(200);
    expect(await prismaTest.order.count({ where: { id: order.id } })).toBe(0);
    await context.close();
  });

  test("without orders.assign a member cannot assign themselves out of the lock", async ({
    seed,
    browser,
  }) => {
    // The escape hatch this feature must not have: assigneeIds travels in the
    // same PATCH body as phaseId, so a blanket orders.edit check would let a
    // restricted member simply add themselves to any order.
    const role = await createTestTeamRole({
      restricted: true,
      permissions: ["orders.edit"], // no orders.assign
    });
    const user = await createTestUser({ email: "trickser@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "trickser@example.com");
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { assigneeIds: [user.id] },
    });
    expect(res.status()).toBe(403);
    expect(await prismaTest.orderAssignee.count({ where: { orderId: order.id } })).toBe(0);
    await context.close();
  });

  test("a mixed payload needs every permission it touches", async ({ seed, browser }) => {
    const role = await createTestTeamRole({
      restricted: false,
      permissions: ["orders.edit"], // no orders.assign
    });
    const user = await createTestUser({ email: "gemischt@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "gemischt@example.com");

    // phaseId alone is fine …
    expect(
      (await page.request.patch(`/api/admin/orders/${order.id}`, {
        data: { phaseId: seed.phases[1].id },
      })).status(),
    ).toBe(200);

    // … but smuggling assigneeIds alongside it is not
    const res = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { phaseId: seed.phases[2].id, assigneeIds: [user.id] },
    });
    expect(res.status()).toBe(403);
    expect(await prismaTest.orderAssignee.count({ where: { orderId: order.id } })).toBe(0);

    await context.close();
  });

  test("comments and uploads follow the same lock", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ restricted: true, permissions: ["orders.edit"] });
    await createTestUser({ email: "kommentar@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "kommentar@example.com");
    const res = await page.request.post("/api/admin/comments", {
      data: { orderId: order.id, content: "Fremder Auftrag" },
    });
    expect(res.status()).toBe(403);
    expect(await prismaTest.orderComment.count({ where: { orderId: order.id } })).toBe(0);
    await context.close();
  });
});

test.describe("permissions are never stale", () => {
  test("granting a right takes effect without a re-login", async ({ seed, browser }) => {
    // Why getActor() reads the DB instead of the JWT: an admin revoking or
    // granting rights must take effect now, not at the member's next sign-in.
    const role = await createTestTeamRole({ restricted: false, permissions: ["orders.edit"] });
    await createTestUser({ email: "sofort@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "sofort@example.com");

    expect((await page.request.delete(`/api/admin/orders/${order.id}`)).status()).toBe(403);

    await prismaTest.teamRolePermission.create({
      data: { roleId: role.id, key: "orders.delete" },
    });

    // same browser context, same JWT
    expect((await page.request.delete(`/api/admin/orders/${order.id}`)).status()).toBe(200);
    await context.close();
  });

  test("a mid-session promotion to ADMIN applies at once", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ restricted: true, permissions: [] });
    const user = await createTestUser({ email: "befoerdert@example.com", teamRoleId: role.id });
    const order = await createTestOrder(seed.phases[0].id);

    const { context, page } = await loginAs(browser, "befoerdert@example.com");
    expect(
      (await page.request.patch(`/api/admin/orders/${order.id}`, {
        data: { phaseId: seed.phases[1].id },
      })).status(),
    ).toBe(403);

    await prismaTest.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });

    expect(
      (await page.request.patch(`/api/admin/orders/${order.id}`, {
        data: { phaseId: seed.phases[1].id },
      })).status(),
    ).toBe(200);
    await context.close();
  });
});
