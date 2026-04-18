import { test, expect } from "../fixtures/test-base";
import { createTestOrder, createTestOrderPart, prismaTest } from "../fixtures/db";
import path from "path";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Per-part iteration tracking", () => {
  test("DESIGN upload increments part iterationCount in DB and writes audit log", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, { isPrototype: true });
    const part = await createTestOrderPart(order.id, { name: "Hauptteil" });

    expect(part.iterationCount).toBe(1);

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Hauptteil").first()).toBeVisible();

    const uploadDone = page.waitForResponse(
      (r) => r.url().includes("/api/admin/uploads") && r.request().method() === "POST"
    );
    const fileInput = page.locator("input[type='file']").first();
    await fileInput.setInputFiles(path.join(__dirname, "../fixtures/test-image.png"));
    await uploadDone;

    const updated = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
    expect(updated!.iterationCount).toBe(2);

    const log = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "PART_ITERATION_INCREMENTED" },
    });
    expect(log).not.toBeNull();
    expect(log!.details).toContain("Iteration #2");
  });

  test("REFERENCE upload does not increment iterationCount", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id, { isPrototype: true });
    const part = await createTestOrderPart(order.id, { name: "Referenzteil" });

    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Referenzteil").first()).toBeVisible();

    await page.getByRole("button", { name: /Referenz/i }).click();

    const uploadDone = page.waitForResponse(
      (r) => r.url().includes("/api/admin/uploads") && r.request().method() === "POST"
    );
    const fileInput = page.locator("input[type='file']").first();
    await fileInput.setInputFiles(path.join(__dirname, "../fixtures/test-image.png"));
    await uploadDone;

    const updated = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
    expect(updated!.iterationCount).toBe(1);

    const log = await prismaTest.auditLog.findFirst({
      where: { orderId: order.id, action: "PART_ITERATION_INCREMENTED" },
    });
    expect(log).toBeNull();
  });

  test("iteration badge shows Iter. #2 when iterationCount is 2", async ({ seed, page }) => {
    // Mark first phase as prototype so iterations are visible
    await prismaTest.orderPhase.update({ where: { id: seed.phases[0].id }, data: { isPrototype: true } });
    const order = await createTestOrder(seed.phases[0].id, { isPrototype: true });
    await createTestOrderPart(order.id, { name: "Druckteil", iterationCount: 2 });

    await page.goto(`/admin/orders/${order.id}`);

    await expect(page.getByText("Iter. #2")).toBeVisible();
  });

  test("iteration badge shows Iter. #1 for new part", async ({ seed, page }) => {
    await prismaTest.orderPhase.update({ where: { id: seed.phases[0].id }, data: { isPrototype: true } });
    const order = await createTestOrder(seed.phases[0].id, { isPrototype: true });
    await createTestOrderPart(order.id, { name: "Neues Teil" });

    await page.goto(`/admin/orders/${order.id}`);

    await expect(page.getByText("Iter. #1")).toBeVisible();
  });

  test("FileManager defaults to Design tab", async ({ seed, page }) => {
    const order = await createTestOrder(seed.phases[0].id);
    const part = await createTestOrderPart(order.id, { name: "Teil" });

    await prismaTest.orderFile.create({
      data: {
        orderId: order.id,
        orderPartId: part.id,
        filename: "test.stl",
        originalName: "test.stl",
        mimeType: "application/octet-stream",
        size: 100,
        source: "TEAM",
        category: "DESIGN",
      },
    });

    await page.goto(`/admin/orders/${order.id}`);

    const designButton = page.getByRole("button", { name: /Design/ }).first();
    await expect(designButton).toBeVisible();
    await expect(designButton).toHaveClass(/bg-primary/);
  });
});
