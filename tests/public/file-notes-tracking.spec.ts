import { test, expect } from "../fixtures/test-base";
import { createTestOrderWithStlFile, createTestFileNote, prismaTest } from "../fixtures/db";

test("customer: sees all notes on tracking page (no per-note filter)", async ({ seed, page }) => {
  const { order, file } = await createTestOrderWithStlFile();
  await createTestFileNote(file.id, { body: "Erste Notiz" });
  await createTestFileNote(file.id, { body: "Zweite Notiz" });

  // Public tracking API returns all notes for non-prototype orders
  const res = await page.request.get(`/api/orders/${order.trackingToken}`);
  const data = await res.json();
  const fileData = data.files.find((f: { id: string }) => f.id === file.id);
  expect(fileData.notes).toHaveLength(2);
  // isCustomerVisible is not sent to customers
  expect(fileData.notes[0].isCustomerVisible).toBeUndefined();
});

test("customer: prototype order exposes no notes", async ({ seed, page }) => {
  const { order, file } = await createTestOrderWithStlFile();
  await prismaTest.order.update({ where: { id: order.id }, data: { isPrototype: true } });
  await createTestFileNote(file.id, { body: "Notiz im Prototyp" });

  const res = await page.request.get(`/api/orders/${order.trackingToken}`);
  const data = await res.json();
  const fileData = data.files.find((f: { id: string }) => f.id === file.id);
  expect(fileData.notes).toHaveLength(0);
});

test("customer: cannot POST, PATCH, DELETE notes (no auth)", async ({ seed, page }) => {
  const { file } = await createTestOrderWithStlFile();
  const note = await createTestFileNote(file.id, { body: "Test" });

  const postRes = await page.request.post(`/api/admin/files/${file.id}/notes`, {
    data: { posX: 0, posY: 0, posZ: 0, normalX: 0, normalY: 1, normalZ: 0, body: "hacked" },
  });
  expect(postRes.status()).toBe(401);

  const patchRes = await page.request.patch(`/api/admin/files/${file.id}/notes/${note.id}`, {
    data: { body: "hacked" },
  });
  expect(patchRes.status()).toBe(401);

  const deleteRes = await page.request.delete(`/api/admin/files/${file.id}/notes/${note.id}`);
  expect(deleteRes.status()).toBe(401);
});

test("customer: tracking page shows thumbnail, no annotation button in dialog", async ({ seed, page }) => {
  const { order, file } = await createTestOrderWithStlFile();
  await createTestFileNote(file.id, { body: "Sichtbare Notiz" });

  await page.goto(`/track/${order.trackingToken}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("tab", { name: /Design/i }).click();

  // Thumbnail or fallback button visible
  await expect(page.getByTitle("3D-Modell ansehen")).toBeVisible({ timeout: 8000 });
  await page.getByTitle("3D-Modell ansehen").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Note panel auto-opens (customer + notes.length > 0)
  await expect(page.getByText("Sichtbare Notiz")).toBeVisible();

  // No annotation mode button in customer mode
  await expect(page.getByRole("button", { name: /Notiz hinzufügen/i })).not.toBeVisible();
});
