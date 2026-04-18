import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";
import path from "path";

const TEST_IMAGE = path.join(__dirname, "../fixtures/test-image.png");

test.describe("Knowledge base", () => {
  test("shows empty state when no entries exist", async ({ seed, page }) => {
    await page.goto("/admin/knowledge");
    await expect(page.getByText(/Noch keine Einträge vorhanden/i)).toBeVisible();
  });

  test("nav link navigates to knowledge base", async ({ seed, page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Wissensdatenbank" }).click();
    await expect(page).toHaveURL("/admin/knowledge");
    await expect(page.getByRole("heading", { name: "Wissensdatenbank" })).toBeVisible();
  });

  test("can create a new entry (transitions to edit mode)", async ({ seed, page }) => {
    await page.goto("/admin/knowledge");

    await page.getByRole("button", { name: /Neu erstellen/i }).click();

    await page.getByLabel("Titel *").fill("PETG Warping");
    await page.getByLabel("Problem *").fill("PETG löst sich vom Druckbett");
    await page.getByLabel("Lösung *").fill("Druckbetttemperatur auf 85°C erhöhen");

    await page.getByPlaceholder("Tag eingeben und Enter drücken...").fill("PETG");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(page.getByRole("heading", { name: "Eintrag bearbeiten" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Anhänge", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Schließen" }).first().click();
    await expect(page.getByText("PETG Warping").first()).toBeVisible({ timeout: 5000 });
  });

  test("can edit an existing entry", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: {
        title: "Edit Me Entry",
        problem: "Some problem",
        solution: "Some solution",
        tags: ["layer-adhesion"],
      },
    });

    await page.goto("/admin/knowledge");
    await expect(page.getByText("Edit Me Entry")).toBeVisible();

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Edit Me Entry" });
    await card.getByRole("button").first().click();

    await page.getByLabel("Titel *").clear();
    await page.getByLabel("Titel *").fill("Edited Entry Title");

    await page.getByRole("button", { name: /^Speichern$/ }).click();

    await page.getByRole("button", { name: "Schließen" }).first().click();

    await expect(page.getByText("Edited Entry Title")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Edit Me Entry")).not.toBeVisible();
  });

  test("can delete an entry (admin only)", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: {
        title: "Delete Me Entry",
        problem: "Problem to delete",
        solution: "Solution to delete",
        tags: [],
      },
    });

    await page.goto("/admin/knowledge");
    await expect(page.getByText("Delete Me Entry")).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Delete Me Entry" });
    await card.getByRole("button").last().click();

    await expect(page.getByText("Delete Me Entry")).not.toBeVisible({ timeout: 5000 });
  });

  test("search filters entries", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Stringing Fix", problem: "Stringing bei PLA", solution: "Retraction erhöhen", tags: ["PLA"] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "Layer Splitting", problem: "Schichten trennen sich", solution: "Temperatur erhöhen", tags: [] },
    });

    await page.goto("/admin/knowledge");
    await expect(page.getByText("Stringing Fix")).toBeVisible();
    await expect(page.getByText("Layer Splitting")).toBeVisible();

    await page.getByPlaceholder("Wissensdatenbank durchsuchen...").fill("Stringing");

    await expect(page.getByText("Stringing Fix")).toBeVisible();
    await expect(page.getByText("Layer Splitting")).not.toBeVisible();
  });

  test("tags from existing entries appear as suggestions", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Tag Source Entry", problem: "p", solution: "s", tags: ["ExistingTag"] },
    });

    await page.goto("/admin/knowledge");
    await page.getByRole("button", { name: /Neu erstellen/i }).click();

    await page.getByPlaceholder("Tag eingeben und Enter drücken...").click();
    await expect(page.getByRole("button", { name: "ExistingTag" })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "ExistingTag" }).click();

    await expect(page.locator("span").filter({ hasText: /^ExistingTag$/ }).first()).toBeVisible();
  });

  test("can upload a file attachment and see it in the file list", async ({ seed, page }) => {
    const entry = await prismaTest.knowledgeEntry.create({
      data: { title: "File Upload Entry", problem: "p", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");
    await expect(page.getByText("File Upload Entry")).toBeVisible();

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "File Upload Entry" });
    await card.getByRole("button").first().click();

    await expect(page.getByText("Anhänge", { exact: true })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);

    await expect(page.getByText("test-image.png")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Schließen" }).first().click();
    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: "File Upload Entry" }).locator('[data-testid="attachment-count"]').getByText("1")
    ).toBeVisible({ timeout: 3000 });
  });

  test("can delete an uploaded file", async ({ seed, page }) => {
    const entry = await prismaTest.knowledgeEntry.create({
      data: { title: "File Delete Entry", problem: "p", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");
    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "File Delete Entry" });
    await card.getByRole("button").first().click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);
    await expect(page.getByText("test-image.png")).toBeVisible({ timeout: 10000 });

    page.on("dialog", (dialog) => dialog.accept());
    const fileRow = page.locator('[data-testid="knowledge-file-row"]').filter({ hasText: "test-image.png" });
    await fileRow.getByRole("button").last().click();

    await expect(page.getByText("test-image.png")).not.toBeVisible({ timeout: 5000 });
  });

  test("wikilink autocomplete: typing [[ shows dropdown with matching entries", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Bed Adhesion Tips", problem: "p", solution: "s", tags: [] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "PETG Warping Source", problem: "p", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "PETG Warping Source" });
    await card.getByRole("button").first().click();

    const problemTextarea = page.getByLabel("Problem *");
    await problemTextarea.click();
    await problemTextarea.fill("See also [[");

    await expect(page.getByRole("button", { name: "Bed Adhesion Tips" }).first()).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Bed Adhesion Tips" }).first().click();

    const value = await problemTextarea.inputValue();
    expect(value).toContain("[[Bed Adhesion Tips]]");
  });

  test("wikilink autocomplete: Escape dismisses dropdown", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Escape Target Entry", problem: "p", solution: "s", tags: [] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "Escape Source Entry", problem: "p", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Escape Source Entry" });
    await card.getByRole("button").first().click();

    const problemTextarea = page.getByLabel("Problem *");
    await problemTextarea.click();
    await problemTextarea.fill("[[Escape");

    await expect(page.getByRole("button", { name: "Escape Target Entry" }).first()).toBeVisible({ timeout: 3000 });

    await problemTextarea.press("Escape");

    await expect(page.getByRole("button", { name: "Escape Target Entry" })).not.toBeVisible({ timeout: 2000 });
  });

  test("wikilink preview renders as clickable chip that opens the linked entry", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Linked Preview Entry", problem: "p", solution: "s", tags: [] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "Source Preview Entry", problem: "See [[Linked Preview Entry]] for details", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Source Preview Entry" });
    await card.getByRole("button").first().click();

    await page.getByText("Vorschau").first().click();

    await expect(page.getByTitle("Öffne: Linked Preview Entry")).toBeVisible({ timeout: 3000 });

    await page.getByTitle("Öffne: Linked Preview Entry").click();
    await expect(page.getByLabel("Titel *")).toHaveValue("Linked Preview Entry", { timeout: 3000 });
  });

  test("backlinks panel shows entries referencing the current entry", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Backlink Target", problem: "p", solution: "s", tags: [] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "Backlink Referrer", problem: "See [[Backlink Target]] for more", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");

    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Backlink Target" });
    await card.getByRole("button").first().click();

    await expect(page.getByText("Erwähnt in:")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Backlink Referrer" })).toBeVisible();

    await page.getByRole("button", { name: "Backlink Referrer" }).click();
    await expect(page.getByLabel("Titel *")).toHaveValue("Backlink Referrer", { timeout: 3000 });
  });

  test("card view shows wikilink as clickable chip", async ({ seed, page }) => {
    await prismaTest.knowledgeEntry.create({
      data: { title: "Card Link Target", problem: "p", solution: "s", tags: [] },
    });
    await prismaTest.knowledgeEntry.create({
      data: { title: "Card Link Source", problem: "Check [[Card Link Target]] for info", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");

    const sourceCard = page.locator('[data-slot="card"]').filter({ hasText: "Card Link Source" });
    const chip = sourceCard.getByRole("button", { name: "Card Link Target" });
    await expect(chip).toBeVisible({ timeout: 3000 });

    await chip.click();
    await expect(page.getByLabel("Titel *")).toHaveValue("Card Link Target", { timeout: 3000 });
  });

  test("Referenz einfügen inserts markdown image reference at cursor", async ({ seed, page }) => {
    const entry = await prismaTest.knowledgeEntry.create({
      data: { title: "Ref Insert Entry", problem: "Initial problem text", solution: "s", tags: [] },
    });

    await page.goto("/admin/knowledge");
    const card = page.locator('[data-slot="card-header"]').filter({ hasText: "Ref Insert Entry" });
    await card.getByRole("button").first().click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);
    await expect(page.getByText("test-image.png")).toBeVisible({ timeout: 10000 });

    const problemTextarea = page.getByLabel("Problem *");
    await problemTextarea.click();

    const fileRow = page.locator('[data-testid="knowledge-file-row"]').filter({ hasText: "test-image.png" });
    await fileRow.getByRole("button", { name: /Referenz einfügen/i }).click();

    const value = await problemTextarea.inputValue();
    expect(value).toContain("![test-image.png]");
    expect(value).toContain(`/api/files/knowledge/${entry.id}/`);
  });
});
