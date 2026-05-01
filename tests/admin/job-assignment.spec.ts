import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestMachine, createTestPrintJob, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Job-Zuweisung", () => {
  let machineId: string;
  let jobId: string;
  let memberId: string;

  test.beforeEach(async ({ seed }) => {
    const machine = await createTestMachine({ name: "Prusa MK4 Test" });
    machineId = machine.id;

    const job = await createTestPrintJob(machineId, { status: "PLANNED" });
    jobId = job.id;

    const member = await createTestUser({ name: "Klaus Bauer", email: "klaus@example.com" });
    memberId = member.id;
  });

  test("happy path: Person einem Job zuweisen per PATCH", async ({ page }) => {
    const res = await page.request.patch(
      `/api/admin/jobs/${jobId}`,
      { data: { assigneeIds: [memberId] } }
    );
    expect(res.status()).toBe(200);
    const { job: body } = await res.json();
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0].user.id).toBe(memberId);

    const inDb = await prismaTest.printJobAssignee.findFirst({ where: { printJobId: jobId } });
    expect(inDb?.userId).toBe(memberId);
  });

  test("happy path: Zuweisung beim Job-POST mitgeben", async ({ page }) => {
    const res = await page.request.post(
      `/api/admin/jobs`,
      { data: { machineId, assigneeIds: [memberId] } }
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0].user.id).toBe(memberId);
  });

  test("TEAM_MEMBER darf Job-Zuweisung setzen (kein Rolecheck auf dieser Route)", async ({ page }) => {
    const res = await page.request.patch(
      `/api/admin/jobs/${jobId}`,
      { data: { assigneeIds: [memberId] } }
    );
    expect(res.status()).toBe(200);
  });

  test("Zuweisung ersetzen: nur neue IDs bleiben", async ({ page }) => {
    await prismaTest.printJobAssignee.create({ data: { printJobId: jobId, userId: memberId } });

    const member2 = await createTestUser({ name: "Eva Koch", email: "eva@example.com" });

    const res = await page.request.patch(
      `/api/admin/jobs/${jobId}`,
      { data: { assigneeIds: [member2.id] } }
    );
    expect(res.status()).toBe(200);
    const { job: body } = await res.json();
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0].user.id).toBe(member2.id);

    const all = await prismaTest.printJobAssignee.findMany({ where: { printJobId: jobId } });
    expect(all).toHaveLength(1);
  });
});
