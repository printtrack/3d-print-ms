import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestSprint, createTestMilestone } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Sprint API + Roadmap-Strip", () => {
  let orderId: string;

  test.beforeEach(async ({ seed }) => {
    void seed;
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("Keine Standardphase");
    const order = await createTestOrder(phase.id, {
      customerName: "Sprint Tester",
      customerEmail: "sprint@example.com",
    });
    orderId = order.id;
  });

  test("happy path: Sprint anlegen, Meilenstein hinzufügen, Task abhaken", async ({ page }) => {
    // Create sprint via API
    const createSprintRes = await page.request.post("/api/admin/sprints", {
      data: { orderId, name: "Vorserie" },
    });
    expect(createSprintRes.ok()).toBe(true);
    const sprint = await createSprintRes.json();
    expect(sprint.name).toBe("Vorserie");

    // Add milestone in that sprint
    const dueIso = new Date("2026-12-15T12:00:00.000Z").toISOString();
    const msRes = await page.request.post("/api/admin/milestones", {
      data: { orderId, sprintId: sprint.id, name: "Druckfreigabe", dueAt: dueIso },
    });
    expect(msRes.ok()).toBe(true);
    const milestone = await msRes.json();
    expect(milestone.sprintId).toBe(sprint.id);

    // Add task
    const taskRes = await page.request.post(
      `/api/admin/milestones/${milestone.id}/tasks`,
      { data: { title: "Kunde anrufen", assigneeIds: [] } }
    );
    expect(taskRes.ok()).toBe(true);
    const task = await taskRes.json();

    // Toggle task complete
    const toggleRes = await page.request.patch(
      `/api/admin/milestones/${milestone.id}/tasks/${task.id}`,
      { data: { completed: true } }
    );
    expect(toggleRes.ok()).toBe(true);

    // Verify state in DB
    const reloaded = await prismaTest.sprint.findUnique({
      where: { id: sprint.id },
      include: { milestones: { include: { tasks: true } } },
    });
    expect(reloaded?.milestones).toHaveLength(1);
    expect(reloaded?.milestones[0].tasks[0].completed).toBe(true);
  });

  test("error case: POST /api/admin/sprints without orderId/projectId returns 400", async ({ page }) => {
    const res = await page.request.post("/api/admin/sprints", {
      data: { name: "Floating Sprint" },
    });
    expect(res.status()).toBe(400);
  });

  test("unauthenticated request to /api/admin/sprints is rejected", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const res = await ctx.request.post("/api/admin/sprints", {
      data: { orderId, name: "Trespasser" },
    });
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  test("delete cascades: removing a sprint detaches its milestones (sprintId → null)", async ({ page }) => {
    const sprint = await createTestSprint(orderId, { name: "Hauptserie" });
    const ms = await createTestMilestone(orderId, { name: "Lackierung" });
    // Link milestone to sprint
    await prismaTest.milestone.update({ where: { id: ms.id }, data: { sprintId: sprint.id } });

    const delRes = await page.request.delete(`/api/admin/sprints/${sprint.id}`);
    expect(delRes.ok()).toBe(true);

    // Milestone should still exist (ON DELETE SET NULL) but sprintId=null
    const remaining = await prismaTest.milestone.findUnique({ where: { id: ms.id } });
    expect(remaining).not.toBeNull();
    expect(remaining?.sprintId).toBeNull();
  });

  test("legacy orphan milestones are auto-migrated into a default sprint on order detail visit", async ({ page }) => {
    // Create a milestone without sprintId (legacy state)
    await createTestMilestone(orderId, { name: "Konzept" });
    const beforeSprintCount = await prismaTest.sprint.count({ where: { orderId } });
    expect(beforeSprintCount).toBe(0);

    await page.goto(`/admin/orders/${orderId}`);
    // RoadmapStrip should be present
    await expect(page.locator('[data-testid="roadmap-strip"]')).toBeVisible();

    const afterSprintCount = await prismaTest.sprint.count({ where: { orderId } });
    expect(afterSprintCount).toBe(1);

    const orphanCount = await prismaTest.milestone.count({ where: { orderId, sprintId: null } });
    expect(orphanCount).toBe(0);
  });

  test("PATCH /api/admin/sprints/[id] renames the sprint", async ({ page }) => {
    const sprint = await createTestSprint(orderId, { name: "Alt" });
    const res = await page.request.patch(`/api/admin/sprints/${sprint.id}`, {
      data: { name: "Neu" },
    });
    expect(res.ok()).toBe(true);
    const reloaded = await prismaTest.sprint.findUnique({ where: { id: sprint.id } });
    expect(reloaded?.name).toBe("Neu");
  });

  test("All-done celebration state activates when every milestone in the sprint is complete", async ({ page }) => {
    const sprint = await createTestSprint(orderId, { name: "Vorserie" });
    const ms1 = await prismaTest.milestone.create({
      data: {
        orderId,
        sprintId: sprint.id,
        name: "Erste Phase",
        dueAt: new Date("2026-04-01T12:00:00Z"),
        completedAt: new Date("2026-04-02T12:00:00Z"),
      },
    });
    const ms2 = await prismaTest.milestone.create({
      data: {
        orderId,
        sprintId: sprint.id,
        name: "Zweite Phase",
        dueAt: new Date("2026-04-15T12:00:00Z"),
        completedAt: new Date("2026-04-16T12:00:00Z"),
      },
    });
    void ms1; void ms2;

    await page.goto(`/admin/orders/${orderId}`);
    const strip = page.locator('[data-testid="roadmap-strip"]');
    await expect(strip).toBeVisible();
    await expect(strip).toHaveAttribute("data-state", "done");
    await expect(strip).toContainText(/Alle Meilensteine erreicht|All milestones reached/);
    await expect(strip).toContainText("2/2");
    // The + button is hidden when the sprint is all done
    await expect(strip.locator('[data-testid="rs-add-milestone-btn"]')).toHaveCount(0);
  });

  test("UI happy path: add sprint via + button then add a milestone", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.locator('[data-testid="roadmap-strip"]')).toBeVisible();

    // Click "+" to add a new sprint
    await page.locator('[data-testid="rs-add-sprint"]').click();
    // Add-milestone popover should auto-open (per design spec)
    await page.locator('input#rs-new-name').fill("Reinigung");
    await page.locator('input#rs-new-date').fill("2026-12-20");
    await page.getByRole("button", { name: /Hinzufügen|Add/ }).click();

    // Server should now have the sprint + milestone
    await expect.poll(async () => {
      const count = await prismaTest.milestone.count({ where: { orderId } });
      return count;
    }).toBe(1);
  });
});
