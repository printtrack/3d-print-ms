import { test, expect, loginAs } from "../fixtures/test-base";
import {
  createTestOrder,
  createTestUser,
  createTestTeamRole,
  createTestMachine,
  createTestPrintJob,
  createTestOrderPart,
  prismaTest,
} from "../fixtures/db";

// Covers the two scope rules that are easy to get wrong:
//   * jobs span several orders (n:m) → access to ALL of them, not any
//   * knowledge/inventory have no assignees → only the permission bit counts

test.describe("print jobs span several orders", () => {
  test("restricted member is refused a job holding somebody else's part", async ({
    seed,
    browser,
  }) => {
    const role = await createTestTeamRole({
      restricted: true,
      permissions: ["orders.edit", "jobs.manage"],
    });
    const user = await createTestUser({ email: "sammel@example.com", teamRoleId: role.id });

    const mine = await createTestOrder(seed.phases[0].id, { customerName: "Meiner" });
    const theirs = await createTestOrder(seed.phases[0].id, { customerName: "Fremder" });
    await prismaTest.orderAssignee.create({ data: { orderId: mine.id, userId: user.id } });

    const machine = await createTestMachine();
    const job = await createTestPrintJob(machine.id);
    for (const orderId of [mine.id, theirs.id]) {
      const part = await createTestOrderPart(orderId, { partPhaseId: seed.partPhases[0].id });
      await prismaTest.printJobPart.create({
        data: { printJobId: job.id, orderPartId: part.id },
      });
    }

    const { context, page } = await loginAs(browser, "sammel@example.com");
    // "any" would let them mutate the other order's parts through the shared job.
    const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
      data: { status: "CANCELLED" },
    });
    expect(res.status()).toBe(403);
    await context.close();
  });

  test("an explicit job assignment grants access anyway", async ({ seed, browser }) => {
    const role = await createTestTeamRole({
      restricted: true,
      permissions: ["orders.edit", "jobs.manage"],
    });
    const user = await createTestUser({ email: "jobmensch@example.com", teamRoleId: role.id });

    const foreign = await createTestOrder(seed.phases[0].id);
    const machine = await createTestMachine();
    const job = await createTestPrintJob(machine.id);
    const part = await createTestOrderPart(foreign.id, { partPhaseId: seed.partPhases[0].id });
    await prismaTest.printJobPart.create({ data: { printJobId: job.id, orderPartId: part.id } });

    // an admin putting someone on a job is a deliberate grant
    await prismaTest.printJobAssignee.create({ data: { printJobId: job.id, userId: user.id } });

    const { context, page } = await loginAs(browser, "jobmensch@example.com");
    const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
      data: { notes: "Läuft" },
    });
    expect(res.status()).toBe(200);
    await context.close();
  });
});

test.describe("knowledge base ignores the assignment lock", () => {
  test("a restricted member with knowledge.create may still write entries", async ({
    seed,
    browser,
  }) => {
    void seed;
    // knowledge has no assignees — restriction is meaningless there, only the bit counts
    const role = await createTestTeamRole({
      restricted: true,
      permissions: ["knowledge.create"],
    });
    await createTestUser({ email: "wissen@example.com", teamRoleId: role.id });

    const { context, page } = await loginAs(browser, "wissen@example.com");
    const res = await page.request.post("/api/admin/knowledge", {
      data: { title: "Warping vermeiden", problem: "Ecken lösen sich", solution: "Brim nutzen" },
    });
    expect(res.status()).toBe(201);
    await context.close();
  });

  test("without knowledge.delete an entry survives — the student scenario", async ({
    seed,
    browser,
  }) => {
    void seed;
    const role = await createTestTeamRole({ permissions: ["knowledge.create", "knowledge.edit"] });
    await createTestUser({ email: "schueler@example.com", teamRoleId: role.id });

    const entry = await prismaTest.knowledgeEntry.create({
      data: { title: "Fremdes Wissen", problem: "P", solution: "L" },
    });

    const { context, page } = await loginAs(browser, "schueler@example.com");
    const res = await page.request.delete(`/api/admin/knowledge/${entry.id}`);
    expect(res.status()).toBe(403);
    expect(await prismaTest.knowledgeEntry.count({ where: { id: entry.id } })).toBe(1);
    await context.close();
  });

  test("the default role cannot touch inventory, as before roles existed", async ({
    seed,
    browser,
  }) => {
    void seed;
    await createTestUser({ email: "standard@example.com" }); // seeded default role

    const { context, page } = await loginAs(browser, "standard@example.com");
    const res = await page.request.post("/api/admin/inventory", {
      data: { name: "PLA", material: "PLA", color: "Rot", spoolWeightGrams: 1000, remainingGrams: 1000 },
    });
    expect(res.status()).toBe(403);
    await context.close();
  });
});
