import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder } from "../fixtures/db";

test.describe("Survey page", () => {
  let surveyToken: string;
  let orderId: string;

  test.beforeEach(async ({ seed }) => {
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) throw new Error("No default phase found");

    const order = await createTestOrder(phase.id, {
      customerName: "Survey Tester",
      customerEmail: "survey@example.com",
    });
    orderId = order.id;

    const survey = await prismaTest.surveyResponse.create({ data: { orderId } });
    surveyToken = survey.token;
  });

  test("renders survey form with default questions", async ({ page }) => {
    await page.goto(`/survey/${surveyToken}`);
    await expect(page.getByText(/Wie war Ihr Erlebnis/i)).toBeVisible();
    await expect(page.getByText(/Wie zufrieden waren Sie/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Feedback absenden/i })).toBeVisible();
  });

  test("shows thank-you screen if already submitted", async ({ page }) => {
    await prismaTest.surveyResponse.update({
      where: { token: surveyToken },
      data: { submittedAt: new Date(), answers: [] },
    });

    await page.goto(`/survey/${surveyToken}`);
    await expect(page.getByText(/Vielen Dank für Ihr Feedback/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Feedback absenden/i })).not.toBeVisible();
  });

  test("returns 404 for unknown token", async ({ page }) => {
    const res = await page.goto("/survey/nonexistent-token-xyz");
    expect(res?.status()).toBe(404);
  });

  test("can submit the survey form", async ({ page }) => {
    await page.goto(`/survey/${surveyToken}`);

    // Star rating buttons: aria-label is "N von 5 Sternen"
    // Rate each question with 4 stars
    const starButtons = page.getByRole("button", { name: /4 von 5 Sternen/i });
    const count = await starButtons.count();
    for (let i = 0; i < count; i++) {
      await starButtons.nth(i).click();
    }

    // Fill in optional comment
    await page.getByPlaceholder(/Was hat Ihnen besonders/i).fill("Alles super!");

    await page.getByRole("button", { name: /Feedback absenden/i }).click();

    // After submit, thank-you message appears
    await expect(page.getByText(/Vielen Dank für Ihr Feedback/i)).toBeVisible({ timeout: 5000 });

    // Verify in DB
    const updated = await prismaTest.surveyResponse.findUnique({ where: { token: surveyToken } });
    expect(updated?.submittedAt).not.toBeNull();
    expect(updated?.comment).toBe("Alles super!");
  });

  test("shows validation error when not all questions rated", async ({ page }) => {
    await page.goto(`/survey/${surveyToken}`);

    // Submit without rating any questions
    await page.getByRole("button", { name: /Feedback absenden/i }).click();

    // Toast error should appear
    await expect(page.getByText(/Bitte bewerten Sie alle Fragen/i)).toBeVisible({ timeout: 3000 });
  });
});
