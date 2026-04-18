import { test, expect } from "../fixtures/test-base";
import { createTestOrder, prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Prototype mode", () => {
  test("Settings: configure prototype phase via PhaseManager dialog", async ({ seed, page }) => {
    const phases = seed.phases;
    const phase = phases[0];

    await page.goto("/admin/settings?tab=phasen");

    const row = page.locator('[data-testid="phase-row"]').filter({ hasText: phase.name });
    await row.getByRole("button").nth(1).click(); // pencil

    const checkbox = page.locator("#is-prototype");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(row.getByText("Prototyp")).toBeVisible({ timeout: 5000 });

    const updated = await prismaTest.orderPhase.findUnique({ where: { id: phase.id } });
    expect(updated?.isPrototype).toBe(true);
  });

  test("OrderCard: prototype badge shows on Kanban", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Prototyp Kunde",
      isPrototype: true,
      iterationCount: 2,
    });

    await page.goto("/admin/orders");
    await expect(page.getByText("Prototyp · #2").first()).toBeVisible();
  });

  test("OrderDetail: prototype switch hidden when order not in prototype phase", async ({ seed, page }) => {
    await prismaTest.orderPhase.update({ where: { id: seed.phases[0].id }, data: { isPrototype: false } });

    const order = await createTestOrder(seed.phases[0].id, { customerName: "Kein Prototyp" });

    await page.goto(`/admin/orders/${order.id}`);

    await expect(page.getByText("Prototyp-Modus")).not.toBeVisible();
  });

  test("OrderDetail: prototype badge appears when isPrototype is true", async ({ seed, page }) => {
    await prismaTest.orderPhase.update({ where: { id: seed.phases[0].id }, data: { isPrototype: true } });

    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Proto Auftrag",
      isPrototype: true,
      iterationCount: 1,
    });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText(/Prototyp · #1/).first()).toBeVisible();
    await expect(page.getByText("Iteration #1").first()).toBeVisible();
  });

  test("OrderDetail: toggle switch enables prototype mode when in prototype phase", async ({ seed, page }) => {
    await prismaTest.orderPhase.update({ where: { id: seed.phases[0].id }, data: { isPrototype: true } });

    const order = await createTestOrder(seed.phases[0].id, { customerName: "Proto Toggle" });

    const patchRes = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { isPrototype: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(patchRes.ok()).toBe(true);

    await page.goto(`/admin/orders/${order.id}`);

    await expect(page.getByText(/Prototyp · #1/).first()).toBeVisible();
    await expect(page.getByText("Iteration #1").first()).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Prototyp-Modus" })).toBeVisible();

    const auditLog = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "PROTOTYPE_ENABLED" },
    });
    expect(auditLog).toBeTruthy();
  });

  test("Verification suppression: no PRICE_APPROVAL created for prototype order", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, {
      customerName: "Proto Freigabe",
      isPrototype: true,
    });

    await prismaTest.verificationRequest.create({
      data: { orderId: order.id, type: "DESIGN_REVIEW", status: "APPROVED" },
    });

    await page.goto(`/admin/orders/${order.id}`);

    const priceInput = page.getByPlaceholder("0.00");
    await priceInput.fill("99.99");
    const saveRes = page.waitForResponse(
      (r) => r.url().includes(`/api/admin/orders/${order.id}`) && r.request().method() === "PATCH"
    );
    await priceInput.blur();
    await saveRes;

    const vrCount = await prismaTest.verificationRequest.count({
      where: { orderId: order.id, type: "PRICE_APPROVAL" },
    });
    expect(vrCount).toBe(0);
  });

  test("File version labels: current design + earlier designs shown for part files", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, { customerName: "Version Test" });

    const part = await prismaTest.orderPart.create({
      data: { orderId: order.id, name: "Test Teil" },
    });

    const now = new Date();
    await prismaTest.orderFile.createMany({
      data: [
        {
          orderId: order.id,
          orderPartId: part.id,
          filename: "file1.stl",
          originalName: "design_v1.stl",
          mimeType: "application/octet-stream",
          size: 1000,
          category: "DESIGN",
          createdAt: new Date(now.getTime() - 2000),
        },
        {
          orderId: order.id,
          orderPartId: part.id,
          filename: "file2.stl",
          originalName: "design_v2.stl",
          mimeType: "application/octet-stream",
          size: 1200,
          category: "DESIGN",
          createdAt: new Date(now.getTime() - 1000),
        },
      ],
    });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Aktuelles Design").first()).toBeVisible();
    await expect(page.getByText("design_v2.stl").first()).toBeVisible();
    await expect(page.getByText(/Frühere Designs/).first()).toBeVisible();
  });
});
