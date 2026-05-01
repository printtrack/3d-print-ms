import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestMilestone, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Assignee-Filter über alle Ebenen", () => {
  let phaseId: string;
  let member: { id: string; name: string };

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("Keine Standardphase");
    phaseId = phase.id;
    member = await createTestUser({ name: "Filter Tester", email: "filter@example.com" });
  });

  test("Auftrag mit Top-Level-Zuweisung erscheint im Filter", async ({ page }) => {
    const order = await createTestOrder(phaseId, { customerName: "Top Level Assigned" });
    await prismaTest.orderAssignee.create({ data: { orderId: order.id, userId: member.id } });

    await page.goto(`/admin/orders?assigneeId=${member.id}`);
    await expect(page.getByText("Top Level Assigned").first()).toBeVisible({ timeout: 8000 });
  });

  test("Auftrag nur mit Part-Zuweisung erscheint im Filter (kein Top-Level)", async ({ page }) => {
    const order = await createTestOrder(phaseId, { customerName: "Part Only Assigned" });
    const part = await createTestOrderPart(order.id, { name: "Gefiltertes Teil" });
    await prismaTest.orderPartAssignee.create({ data: { orderPartId: part.id, userId: member.id } });

    await page.goto(`/admin/orders?assigneeId=${member.id}`);
    await expect(page.getByText("Part Only Assigned").first()).toBeVisible({ timeout: 8000 });
  });

  test("Auftrag nur mit Task-Zuweisung erscheint im Filter", async ({ page }) => {
    const order = await createTestOrder(phaseId, { customerName: "Task Only Assigned" });
    const milestone = await createTestMilestone(order.id, { name: "Filter Milestone" });
    const task = await prismaTest.milestoneTask.create({
      data: { milestoneId: milestone.id, title: "Filter Aufgabe", position: 0 },
    });
    await prismaTest.milestoneTaskAssignee.create({ data: { taskId: task.id, userId: member.id } });

    await page.goto(`/admin/orders?assigneeId=${member.id}`);
    await expect(page.getByText("Task Only Assigned").first()).toBeVisible({ timeout: 8000 });
  });

  test("Auftrag ohne jede Zuweisung erscheint NICHT im Filter", async ({ page }) => {
    await createTestOrder(phaseId, { customerName: "Nicht Zugewiesen" });

    await page.goto(`/admin/orders?assigneeId=${member.id}`);
    await expect(page.getByText("Nicht Zugewiesen").first()).not.toBeVisible({ timeout: 5000 });
  });

  test("FilterBar zeigt Personen-Chip für aktiven Filter", async ({ page }) => {
    await page.goto(`/admin/orders?assigneeId=${member.id}`);
    await expect(page.getByText("Filter Tester")).toBeVisible({ timeout: 8000 });
  });
});
