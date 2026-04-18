import path from "path";
import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestCustomer, createTestCreditTransaction, createTestMilestone } from "../fixtures/db";

test.describe("Order detail page", () => {
  let orderId: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");
    const order = await createTestOrder(phase.id, {
      customerName: "Detail Tester",
      customerEmail: "detail@example.com",
      description: "Order for detail page testing",
    });
    orderId = order.id;
  });

  test("displays order details", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Detail Tester")).toBeVisible();
    await expect(page.getByText("detail@example.com")).toBeVisible();
    await expect(page.getByText("Order for detail page testing")).toBeVisible();
  });

  test("shows current phase", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Eingegangen").first()).toBeVisible();
  });

  test("can post a comment", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    const commentInput = page.getByPlaceholder(/Kommentar/i);
    await commentInput.fill("This is a test comment from Playwright");

    await page.getByRole("button", { name: /Kommentieren/i }).click();

    await expect(page.getByText("This is a test comment from Playwright")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows audit log section", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Aktivitätsprotokoll|Audit|Verlauf/i)).toBeVisible();
  });

  test("can change order phase", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    const phaseSelect = page.getByRole("combobox").first();
    await phaseSelect.click();

    await page.getByRole("option", { name: "In Prüfung" }).click();

    await expect(page.getByText("In Prüfung").first()).toBeVisible();
  });

  test("back link returns to dashboard", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    const backLink = page.getByRole("link", { name: /Dashboard|Zurück/i }).first();
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL("**/admin**");
  });

  test("admin can archive an order", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    const archiveDone = page.waitForResponse(
      (r) => r.url().includes(`/api/admin/orders/${orderId}`) && r.request().method() === "PATCH"
    );

    const archiveBtn = page.getByRole("button", { name: /Archivieren/i });
    await expect(archiveBtn).toBeVisible();
    await archiveBtn.click();

    const confirmBtn = page.getByRole("button", { name: /Bestätigen|Ja|Archivieren/i }).last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }

    await archiveDone;
    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(updated?.archivedAt).not.toBeNull();
  });

  test("shows price estimation section", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Angebot \/ Preis/i)).toBeVisible();
    await expect(page.getByPlaceholder("0.00")).toBeVisible();
  });

  test("can save a price estimate", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    const priceInput = page.getByPlaceholder("0.00");
    await priceInput.fill("24.99");
    const saveRes = page.waitForResponse(
      (r) => r.url().includes(`/api/admin/orders/${orderId}`) && r.request().method() === "PATCH"
    );
    await priceInput.blur();
    await saveRes;

    const updated = await prismaTest.order.findUnique({ where: { id: orderId } });
    expect(Number(updated?.priceEstimate)).toBeCloseTo(24.99, 1);
  });

  test("shows survey section as not yet sent when no survey exists", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Noch nicht gesendet/i)).toBeVisible();
  });

  test("shows survey sent status after survey is created", async ({ page }) => {
    await prismaTest.surveyResponse.create({ data: { orderId } });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Gesendet/i)).toBeVisible();
  });

  test("shows survey results after submission", async ({ page }) => {
    await prismaTest.surveyResponse.create({
      data: {
        orderId,
        submittedAt: new Date(),
        answers: [{ question: "Qualität?", rating: 4 }],
        comment: "Super Arbeit!",
      },
    });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Eingegangen/i).first()).toBeVisible();
    await expect(page.getByText("Super Arbeit!")).toBeVisible();
  });

  test("shows admin file manager with upload drop zone", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/hier ablegen/i).first()).toBeVisible();
    await expect(page.getByText("Dateien", { exact: true })).toBeVisible();
  });

  test("credit section is hidden when customer has no registered account", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Filament-Guthaben")).not.toBeVisible();
  });

  test("credit section is visible when customer has a registered account", async ({ page }) => {
    await createTestCustomer({ email: "detail@example.com" });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Filament-Guthaben")).toBeVisible();
  });

  test("can deduct credits from order detail page", async ({ page }) => {
    const customer = await createTestCustomer({ email: "detail@example.com" });
    await createTestCreditTransaction(customer.id, 300, "Initial top-up");

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Filament-Guthaben")).toBeVisible();
    await expect(page.getByText("300 g")).toBeVisible();

    await page.getByRole("button", { name: "Guthaben abziehen" }).click();

    await page.getByPlaceholder("z.B. 45").fill("50");

    await page.getByRole("button", { name: /^Abziehen$/ }).click();

    await expect(page.getByText("250 g")).toBeVisible({ timeout: 5000 });

    const updated = await prismaTest.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.creditBalance).toBe(250);
  });

  test("shows milestones card in sidebar", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText(/Meilensteine/i).first()).toBeVisible();
  });

  test("can create a milestone via + Hinzufügen", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    const milestonesCard = page.locator('[data-slot="card"]').filter({ hasText: /Meilensteine/ });
    await milestonesCard.getByRole("button", { name: /Neu/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#milestone-name").fill("Erster Meilenstein");
    await dialog.getByRole("button", { name: /^Speichern$/ }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(milestonesCard.getByText("Erster Meilenstein")).toBeVisible({ timeout: 5000 });
  });

  test("click milestone row opens edit dialog with correct name", async ({ page }) => {
    const milestone = await createTestMilestone(orderId, { name: "Entwurf abgeschlossen" });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Entwurf abgeschlossen")).toBeVisible();

    await page.getByText("Entwurf abgeschlossen").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#milestone-name")).toHaveValue("Entwurf abgeschlossen");

    await dialog.getByRole("button", { name: "Abbrechen" }).click();
  });

  test("can delete a milestone from edit dialog", async ({ page }) => {
    const milestone = await createTestMilestone(orderId, { name: "Zu löschender Meilenstein" });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(page.getByText("Zu löschender Meilenstein")).toBeVisible();

    await page.getByText("Zu löschender Meilenstein").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await dialog.getByRole("button", { name: "Löschen" }).click();

    await expect(page.getByText("Zu löschender Meilenstein")).not.toBeVisible({ timeout: 5000 });

    const deleted = await prismaTest.milestone.findUnique({ where: { id: milestone.id } });
    expect(deleted).toBeNull();
  });

  test("can upload a team design file and sees Team badge + audit entry", async ({ page }) => {
    await page.goto(`/admin/orders/${orderId}`);

    await expect(page.getByText(/hier ablegen/i).first()).toBeVisible();
    const uploadDone = page.waitForResponse(
      (r) => r.url().includes("/api/admin/uploads") && r.request().method() === "POST"
    );
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(__dirname, "../fixtures/test-image.png"));
    await uploadDone;

    await expect(page.getByText("Team").first()).toBeVisible({ timeout: 5000 });

    await page.getByText("Verlauf").click();
    await expect(page.getByText(/Designdatei vom Team hochgeladen/i)).toBeVisible();

    const files = await prismaTest.orderFile.findMany({ where: { orderId } });
    expect(files.some((f) => f.source === "TEAM")).toBe(true);
  });
});
