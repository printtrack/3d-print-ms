import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestMilestone, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("MilestoneTask Multi-Zuweisung", () => {
  let orderId: string;
  let milestoneId: string;
  let member1Id: string;
  let member2Id: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("Keine Standardphase");

    const order = await createTestOrder(phase.id, {
      customerName: "Milestone Task Tester",
      customerEmail: "milestonetask@example.com",
    });
    orderId = order.id;

    const milestone = await createTestMilestone(orderId, { name: "Sprint 1" });
    milestoneId = milestone.id;

    const m1 = await createTestUser({ name: "Anna Schmidt", email: "anna@example.com" });
    const m2 = await createTestUser({ name: "Ben Weber", email: "ben@example.com" });
    member1Id = m1.id;
    member2Id = m2.id;
  });

  test("happy path: Task mit zwei Personen anlegen", async ({ page }) => {
    const res = await page.request.post(
      `/api/admin/milestones/${milestoneId}/tasks`,
      { data: { title: "Design prüfen", assigneeIds: [member1Id, member2Id] } }
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.assignees).toHaveLength(2);
    const ids = body.assignees.map((a: { user: { id: string } }) => a.user.id);
    expect(ids).toContain(member1Id);
    expect(ids).toContain(member2Id);
  });

  test("happy path: Task-Zuweisung per PATCH aktualisieren", async ({ page }) => {
    const createRes = await page.request.post(
      `/api/admin/milestones/${milestoneId}/tasks`,
      { data: { title: "Test Aufgabe", assigneeIds: [member1Id] } }
    );
    const { id: taskId } = await createRes.json();

    const patchRes = await page.request.patch(
      `/api/admin/milestones/${milestoneId}/tasks/${taskId}`,
      { data: { assigneeIds: [member2Id] } }
    );
    expect(patchRes.status()).toBe(200);
    const body = await patchRes.json();
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0].user.id).toBe(member2Id);

    const inDb = await prismaTest.milestoneTaskAssignee.findMany({ where: { taskId } });
    expect(inDb).toHaveLength(1);
    expect(inDb[0].userId).toBe(member2Id);
  });

  test("Task ohne Assignee anlegen liefert leeres assignees-Array", async ({ page }) => {
    const res = await page.request.post(
      `/api/admin/milestones/${milestoneId}/tasks`,
      { data: { title: "Unzugewiesen" } }
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.assignees).toHaveLength(0);
  });

  test("Datenmigration: assigneeId-Spalte existiert nicht mehr", async ({ page }) => {
    const columns = await prismaTest.$queryRaw<Array<{ COLUMN_NAME: string }>>`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MilestoneTask' AND COLUMN_NAME = 'assigneeId'
    `;
    expect(columns).toHaveLength(0);
  });
});
