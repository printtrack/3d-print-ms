import { test, expect } from "../fixtures/test-base";
import { createTestOrderWithStlFile, createTestFileNote } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("admin: creates a note via API and sees it in the dialog", async ({ seed, page }) => {
  const { order, file } = await createTestOrderWithStlFile();

  // Create note BEFORE navigating so initialNotes is populated from server
  const res = await page.request.post(`/api/admin/files/${file.id}/notes`, {
    data: {
      posX: 0, posY: 0, posZ: 0,
      normalX: 0, normalY: 1, normalZ: 0,
      body: "Loch zu klein — bitte auf 5mm Durchmesser aufweiten",
    },
  });
  expect(res.ok()).toBeTruthy();
  const note = await res.json();
  expect(note.id).toBeTruthy();
  expect(note.isCustomerVisible).toBe(true);

  // Navigate after note is created
  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByText("Dateien & Teile")).toBeVisible({ timeout: 15000 });
  await page.locator("text=Test STL Teil").click();
  await expect(page.getByTitle("3D-Modell ansehen")).toBeVisible();

  // Open dialog via filename click or thumbnail
  await page.getByTitle("3D-Modell ansehen").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Notes badge opens the panel
  await page.getByRole("button", { name: /^\d+ Notiz/i }).click();
  await expect(page.getByText("Loch zu klein — bitte auf 5mm Durchmesser aufweiten").first()).toBeVisible();
  await expect(page.getByText(/Notizen.*\(1\)/)).toBeVisible();
});

test("admin: edits a note body", async ({ seed, page }) => {
  const { file } = await createTestOrderWithStlFile();
  const note = await createTestFileNote(file.id, { body: "Ursprünglicher Text" });

  const patchRes = await page.request.patch(`/api/admin/files/${file.id}/notes/${note.id}`, {
    data: { body: "Geänderter Text" },
  });
  expect(patchRes.ok()).toBeTruthy();
  const updated = await patchRes.json();
  expect(updated.body).toBe("Geänderter Text");
});

test("admin: deletes a note", async ({ seed, page }) => {
  const { file } = await createTestOrderWithStlFile();
  const note = await createTestFileNote(file.id, { body: "Zu löschende Notiz" });

  const deleteRes = await page.request.delete(`/api/admin/files/${file.id}/notes/${note.id}`);
  expect(deleteRes.ok()).toBeTruthy();

  const getRes = await page.request.get(`/api/admin/files/${file.id}/notes`);
  const notes = await getRes.json();
  expect(notes.find((n: { id: string }) => n.id === note.id)).toBeUndefined();
});

// Auth-boundary test lives in file-notes-tracking.spec.ts (public) where request has no auth

test("admin: POST on non-existent fileId returns 404", async ({ seed, page }) => {
  const res = await page.request.post(`/api/admin/files/nonexistent-id/notes`, {
    data: { posX: 0, posY: 0, posZ: 0, normalX: 0, normalY: 1, normalZ: 0, body: "test" },
  });
  expect(res.status()).toBe(404);
});

test("admin: note has dialog UI with edit and delete buttons (no resolve button)", async ({ seed, page }) => {
  const { order, file } = await createTestOrderWithStlFile();
  await createTestFileNote(file.id, { body: "UI Test Notiz" });

  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByText("Dateien & Teile")).toBeVisible({ timeout: 15000 });
  await page.locator("text=Test STL Teil").click();
  await page.getByTitle("3D-Modell ansehen").click();

  await expect(page.getByRole("dialog")).toBeVisible();

  // Open notes panel via badge button (text is "N Notiz" or "N Notizen")
  await page.getByRole("button", { name: /^\d+ Notiz/i }).click();
  await expect(page.getByText("UI Test Notiz")).toBeVisible();

  const dialog = page.getByRole("dialog");
  // Edit and delete buttons present (scoped to dialog)
  await expect(dialog.getByTitle("Bearbeiten")).toBeVisible();
  await expect(dialog.getByTitle("Löschen")).toBeVisible();

  // No "Als erledigt" button (resolve feature removed)
  await expect(dialog.getByTitle("Als erledigt markieren")).not.toBeVisible();

  // Annotation mode button visible (floating, admin only)
  await expect(dialog.getByRole("button", { name: /Notiz hinzufügen/i })).toBeVisible();
});
