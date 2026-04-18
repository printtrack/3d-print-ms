import { test, expect } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { createTestCustomer, createTestOrder, prismaTest } from "../fixtures/db";

async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/portal/signin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("/portal");
}

test("shows order description and phase on detail page", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, {
    customerEmail: customer.email,
    description: "Detailbeschreibung Testauftrag",
  });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page.getByText("Detailbeschreibung Testauftrag")).toBeVisible();
  await expect(page.getByText("Eingegangen")).toBeVisible();
});

test("does not show Zum öffentlichen Status link", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, { customerEmail: customer.email });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page.getByRole("link", { name: /öffentlichen Status/i })).not.toBeVisible();
  await expect(page.getByRole("link", { name: /Öffentlicher Status/i })).not.toBeVisible();
});

test("file upload section is visible on order detail", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, { customerEmail: customer.email });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page.getByText("Weitere Dateien hochladen")).toBeVisible();
  await expect(page.getByText("Dateien auswählen")).toBeVisible();
});

test("pending verification request shows approve/reject buttons; clicking approve hides them", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, { customerEmail: customer.email });
  await prismaTest.verificationRequest.create({
    data: { orderId: order.id, type: "DESIGN_REVIEW" },
  });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page.getByRole("button", { name: /Freigabe erteilen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ablehnen/ })).toBeVisible();

  await page.getByRole("button", { name: /Freigabe erteilen/ }).click();

  await expect(page.getByRole("button", { name: /Freigabe erteilen/ })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Ablehnen/ })).not.toBeVisible();
});

test("survey link appears when surveyResponse exists and is not submitted", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, { customerEmail: customer.email });
  const survey = await prismaTest.surveyResponse.create({
    data: { orderId: order.id },
  });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  const surveyLink = page.getByRole("link", { name: /Jetzt Feedback geben/ });
  await expect(surveyLink).toBeVisible();
  await expect(surveyLink).toHaveAttribute("href", `/survey/${survey.token}`);
});

test("shows thank-you message when survey is already submitted", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "kunde@example.com", password: "passwort123" });
  const order = await createTestOrder(seed.phases[0].id, { customerEmail: customer.email });
  await prismaTest.surveyResponse.create({
    data: { orderId: order.id, submittedAt: new Date() },
  });

  await loginAsCustomer(page, "kunde@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page.getByText(/Bewertung abgegeben.*Danke/i)).toBeVisible();
});

test("order from another customer returns 404", async ({ seed, page }) => {
  await createTestCustomer({ email: "kunde1@example.com", password: "passwort123" });
  await createTestCustomer({ email: "kunde2@example.com", password: "passwort123" });

  const order = await createTestOrder(seed.phases[0].id, { customerEmail: "kunde2@example.com" });

  await loginAsCustomer(page, "kunde1@example.com", "passwort123");
  await page.goto(`/portal/orders/${order.id}`);

  await expect(page).toHaveURL(/\/portal\/orders\//);
  // Next.js notFound() renders a 404 page
  await expect(page.getByText(/404|nicht gefunden/i).first()).toBeVisible();
});

test("unauthenticated access to order detail redirects to signin", async ({ seed, page }) => {
  await page.goto("/portal/orders/some-id");
  await expect(page).toHaveURL(/\/portal\/signin/);
});
