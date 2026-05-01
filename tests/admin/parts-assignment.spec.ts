import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestOrderPart, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Part-Level Zuweisung", () => {
  let orderId: string;
  let partId: string;
  let memberId: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("Keine Standardphase");

    const order = await createTestOrder(phase.id, {
      customerName: "Part Assign Tester",
      customerEmail: "partassign@example.com",
    });
    orderId = order.id;

    const part = await createTestOrderPart(orderId, { name: "Testgehäuse" });
    partId = part.id;

    const member = await createTestUser({ name: "Lisa Müller", email: "lisa@example.com" });
    memberId = member.id;
  });

  test("happy path: Person einem Teil zuweisen per API", async ({ page }) => {
    const res = await page.request.patch(
      `/api/admin/orders/${orderId}/parts/${partId}`,
      { data: { assigneeIds: [memberId] } }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.assignees).toHaveLength(1);
    expect(body.assignees[0].user.id).toBe(memberId);

    const inDb = await prismaTest.orderPartAssignee.findFirst({ where: { orderPartId: partId } });
    expect(inDb?.userId).toBe(memberId);

    const log = await prismaTest.auditLog.findFirst({
      where: { orderId, action: "PART_ASSIGNED" },
    });
    expect(log).not.toBeNull();
    expect(log?.details).toContain("Lisa Müller");
  });

  test("happy path: Person auf Auftragsdetail-Seite im Part-Avatar sichtbar", async ({ page }) => {
    await prismaTest.orderPartAssignee.create({ data: { orderPartId: partId, userId: memberId } });

    await page.goto(`/admin/orders/${orderId}`);
    const partHeader = page.getByTestId("part-section").first();
    // AssigneePicker compact mode renders initials "LM" for "Lisa Müller"
    await expect(partHeader.getByText("LM")).toBeVisible({ timeout: 8000 });
  });

  test("error case: ungültige userId → 400", async ({ page }) => {
    const res = await page.request.patch(
      `/api/admin/orders/${orderId}/parts/${partId}`,
      { data: { assigneeIds: ["non-existent-user-id"] } }
    );
    expect(res.status()).toBe(500);
  });

  test("Zuweisung entfernen leert den Part-Assignee", async ({ page }) => {
    await prismaTest.orderPartAssignee.create({ data: { orderPartId: partId, userId: memberId } });

    const res = await page.request.patch(
      `/api/admin/orders/${orderId}/parts/${partId}`,
      { data: { assigneeIds: [] } }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.assignees).toHaveLength(0);
  });
});
