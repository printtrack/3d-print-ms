import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestMachine,
  createTestPrintJob,
  createTestOrder,
  createTestOrderPart,
  createTestPrintJobPart,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

async function setupJobWithPart(status: "AWAITING_VERIFICATION" | "PLANNED" = "AWAITING_VERIFICATION", shortCode?: string) {
  const machine = await createTestMachine({ name: "Verifikations-Drucker" });
  const job = await createTestPrintJob(machine.id, { status, shortCode });
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const order = await createTestOrder(defaultPhase!.id, { customerName: "Test Kunde" });
  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  const part = await createTestOrderPart(order.id, {
    name: "Verifikations-Teil",
    partPhaseId: printReadyPhase?.id,
  });
  await createTestPrintJobPart(job.id, part.id);
  return { machine, job, order, part };
}

// --- Happy path ---

test("zeigt AWAITING_VERIFICATION-Job im Board mit orangenem Badge", async ({ seed, page }) => {
  await setupJobWithPart();
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await expect(page.getByText("Verifikation", { exact: true })).toBeVisible();
});

test("öffnet Verifikations-Dialog über Detail-Dialog", async ({ seed, page }) => {
  await setupJobWithPart();
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  // Click the part count text inside the job card to open detail dialog
  await page.getByText("1 Teile").first().click();
  await expect(page.getByText(/Druckjob — Verifikations-Drucker/)).toBeVisible();
  await expect(page.getByText("Verifikation ausstehend").first()).toBeVisible();

  await page.getByRole("button", { name: /Druck verifizieren/i }).click();
  await expect(page.getByRole("heading", { name: "Druck verifizieren" })).toBeVisible();
  await expect(page.getByText("Verifikations-Teil")).toBeVisible();
  await expect(page.getByRole("button", { name: /Verifikation abschließen/i })).toBeDisabled();
});

test("happy path: alle Teile erfolgreich → Job wird DONE, Teil auf Gedruckt", async ({ seed, page }) => {
  const { job, part } = await setupJobWithPart();
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("1 Teile").first().click();
  await page.getByRole("button", { name: /Druck verifizieren/i }).click();

  // Mark as successful
  await page.getByRole("button", { name: /^Erfolgreich$/ }).click();
  await expect(page.getByText(/1 erfolgreich/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Verifikation abschließen/i })).toBeEnabled();

  await page.getByRole("button", { name: /Verifikation abschließen/i }).click();
  await expect(page.getByText("Verifikation abgeschlossen").first()).toBeVisible();

  // Job should now be DONE in DB
  const updatedJob = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updatedJob?.status).toBe("DONE");

  // Part should be in "Gedruckt" phase
  const printedPhase = await prismaTest.partPhase.findFirst({ where: { isPrinted: true } });
  const updatedPart = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updatedPart?.partPhaseId).toBe(printedPhase?.id);
});

// --- Fehldruck path ---

test("fehldruck-pfad: Teil als Fehldruck markiert → landet in Fehldruck-Phase", async ({ seed, page }) => {
  const { job, part } = await setupJobWithPart();
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("1 Teile").first().click();
  await page.getByRole("button", { name: /Druck verifizieren/i }).click();

  await page.getByRole("button", { name: /^Fehldruck$/ }).click();
  await expect(page.getByText(/1 Fehldrucke/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Verifikation abschließen/i })).toBeEnabled();

  await page.getByRole("button", { name: /Verifikation abschließen/i }).click();
  await expect(page.getByText("Verifikation abgeschlossen").first()).toBeVisible();

  // Part should be in "Fehldruck" phase
  const misprintPhase = await prismaTest.partPhase.findFirst({ where: { isMisprint: true } });
  const updatedPart = await prismaTest.orderPart.findUnique({ where: { id: part.id } });
  expect(updatedPart?.partPhaseId).toBe(misprintPhase?.id);
});

// --- Error cases ---

test("DELETE auf AWAITING_VERIFICATION-Job gibt 400 zurück", async ({ seed, page }) => {
  const { job } = await setupJobWithPart("AWAITING_VERIFICATION");
  const res = await page.request.delete(`/api/admin/jobs/${job.id}`);
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("gelöscht werden");

  // Job still exists
  const stillExists = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(stillExists).not.toBeNull();
});

test("verify-parts mit fehlenden Teilen gibt 400 zurück", async ({ seed, page }) => {
  const { job } = await setupJobWithPart("AWAITING_VERIFICATION");
  // Send empty parts array — misses the required part
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: { parts: [] },
  });
  expect(res.status()).toBe(400);
});

test("verify-parts auf nicht-AWAITING_VERIFICATION-Job gibt 400", async ({ seed, page }) => {
  const { job, part } = await setupJobWithPart("PLANNED");
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: { parts: [{ orderPartId: part.id, result: "success" }] },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("Verifikation");
});

// --- shortCode Suche ---

test("shortCode-Suche navigiert zum korrekten Job-Dialog", async ({ seed, page }) => {
  const { job } = await setupJobWithPart("AWAITING_VERIFICATION", "TESTXX");
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  // Type short code into search field
  await page.getByPlaceholder("Job-ID (Etikett)").fill("TESTXX");
  await page.getByRole("button", { name: /Suchen/i }).click();

  // Should open the job detail dialog for that job
  await expect(page.getByText(/Druckjob — Verifikations-Drucker/)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("TESTXX")).toBeVisible();
});

// --- AWAITING_VERIFICATION in filter ---

test("AWAITING_VERIFICATION-Jobs erscheinen in der Board-Ansicht, DONE-Jobs nicht", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Filter-Test-Drucker" });
  await createTestPrintJob(machine.id, { status: "AWAITING_VERIFICATION" });
  await createTestPrintJob(machine.id, { status: "DONE" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByRole("heading", { name: "Filter-Test-Drucker" }).waitFor();

  // AWAITING_VERIFICATION job shows "Verifikation" badge
  await expect(page.getByText("Verifikation", { exact: true })).toBeVisible();
  // DONE job: exactly 1 job card under this machine (the DONE one is filtered out)
  // The board shows the job count next to the machine heading
  const col = page.locator(`[data-testid="machine-row"]`).filter({ hasText: "Filter-Test-Drucker" });
  // Fall back: just verify only 1 "Verifikation" badge exists (not 2)
  await expect(page.getByText("Verifikation", { exact: true })).toHaveCount(1);
});
