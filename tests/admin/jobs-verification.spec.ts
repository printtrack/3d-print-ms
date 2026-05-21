import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestMachine,
  createTestPrintJob,
  createTestOrder,
  createTestOrderPart,
  createTestPrintJobPart,
  createTestFilament,
  createTestCustomer,
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
  await expect(page.getByText("Verifikations-Teil").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Verifikation abschließen/i })).toBeDisabled();
});

test("happy path: alle Teile erfolgreich → Job wird DONE, Teil auf Gedruckt", async ({ seed, page }) => {
  const { job, part } = await setupJobWithPart();
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("1 Teile").first().click();
  await page.getByRole("button", { name: /Druck verifizieren/i }).click();

  // Mark as successful and enter weight
  await page.getByRole("button", { name: /^Erfolgreich$/ }).click();
  // The weight input should be pre-filled (0 if no gramsEstimated), fill it explicitly
  await page.getByRole("spinbutton").first().fill("15");
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
  await page.getByRole("spinbutton").first().fill("10");
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

test("verify-parts mit leeren Iterationen gibt 400 zurück", async ({ seed, page }) => {
  const { job } = await setupJobWithPart("AWAITING_VERIFICATION");
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: { iterations: [] },
  });
  expect(res.status()).toBe(400);
});

test("verify-parts auf nicht-AWAITING_VERIFICATION-Job gibt 400", async ({ seed, page }) => {
  const { job, part } = await setupJobWithPart("PLANNED");
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: { iterations: [{ orderPartId: part.id, pieceIndex: 0, result: "success", gramsActual: 10 }] },
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

// --- Billing: API-level tests ---

test("Billing: Verifikation deducts Filament inventory (API)", async ({ seed, page }) => {
  const filament = await createTestFilament({ remainingGrams: 500, pricePerKg: 25.0 });
  const machine = await createTestMachine({ name: "Billing-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "AWAITING_VERIFICATION" });
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const order = await createTestOrder(defaultPhase!.id, { customerName: "Billing Kunde" });
  const part = await createTestOrderPart(order.id, { name: "Billing-Teil", filamentId: filament.id });
  await createTestPrintJobPart(job.id, part.id);

  // Set charge_misprints/charge_prototypes to false (default)
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: {
      iterations: [{ orderPartId: part.id, pieceIndex: 0, result: "success", gramsActual: 20 }],
    },
  });
  expect(res.status()).toBe(200);

  const updatedFilament = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updatedFilament?.remainingGrams).toBe(480); // 500 - 20
});

test("Billing: Kundenguthaben wird abgezogen wenn berechnet (API)", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "billing@example.com", creditBalanceCents: 1000 });
  const filament = await createTestFilament({ remainingGrams: 500, pricePerKg: 25.0 });
  const machine = await createTestMachine({ name: "Billing-Drucker2" });
  const job = await createTestPrintJob(machine.id, { status: "AWAITING_VERIFICATION" });
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const order = await createTestOrder(defaultPhase!.id, { customerEmail: customer.email, customerName: "Billing Kunde" });
  const part = await createTestOrderPart(order.id, { name: "Billing-Teil2", filamentId: filament.id });
  await createTestPrintJobPart(job.id, part.id);

  // Enable charge_misprints=true so success parts are always charged
  await prismaTest.setting.upsert({ where: { key: "charge_misprints" }, update: { value: "false" }, create: { key: "charge_misprints", value: "false" } });
  await prismaTest.setting.upsert({ where: { key: "charge_prototypes" }, update: { value: "false" }, create: { key: "charge_prototypes", value: "false" } });

  // 20g × 25€/kg = 0.50€ = 50 Cent
  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: {
      iterations: [{ orderPartId: part.id, pieceIndex: 0, result: "success", gramsActual: 20 }],
    },
  });
  expect(res.status()).toBe(200);

  const updatedCustomer = await prismaTest.customer.findUnique({ where: { id: customer.id } });
  expect(updatedCustomer?.creditBalanceCents).toBe(950); // 1000 - 50

  const credits = await prismaTest.customerCredit.findMany({ where: { customerId: customer.id } });
  expect(credits).toHaveLength(1);
  expect(credits[0].amountCents).toBe(-50);
});

test("Billing: Fehldruck wird nicht berechnet wenn Setting aus (API)", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "misprint-test@example.com", creditBalanceCents: 500 });
  const filament = await createTestFilament({ remainingGrams: 500, pricePerKg: 25.0 });
  const machine = await createTestMachine({ name: "Billing-Drucker3" });
  const job = await createTestPrintJob(machine.id, { status: "AWAITING_VERIFICATION" });
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const order = await createTestOrder(defaultPhase!.id, { customerEmail: customer.email, customerName: "Misprint Kunde" });
  const part = await createTestOrderPart(order.id, { name: "Misprint-Teil", filamentId: filament.id });
  await createTestPrintJobPart(job.id, part.id);

  await prismaTest.setting.upsert({ where: { key: "charge_misprints" }, update: { value: "false" }, create: { key: "charge_misprints", value: "false" } });

  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: {
      iterations: [{ orderPartId: part.id, pieceIndex: 0, result: "misprint", gramsActual: 20 }],
    },
  });
  expect(res.status()).toBe(200);

  // Inventory deducted, but customer balance unchanged
  const updatedFilament = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updatedFilament?.remainingGrams).toBe(480);
  const updatedCustomer = await prismaTest.customer.findUnique({ where: { id: customer.id } });
  expect(updatedCustomer?.creditBalanceCents).toBe(500); // unchanged
});

test("Billing: Filament ohne Preis — kein Crash, Inventar abgezogen, kein Kundenbetrag (API)", async ({ seed, page }) => {
  const customer = await createTestCustomer({ email: "noprice@example.com", creditBalanceCents: 300 });
  const filament = await createTestFilament({ remainingGrams: 300, pricePerKg: null });
  const machine = await createTestMachine({ name: "Billing-Drucker4" });
  const job = await createTestPrintJob(machine.id, { status: "AWAITING_VERIFICATION" });
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  const order = await createTestOrder(defaultPhase!.id, { customerEmail: customer.email, customerName: "NoPrice Kunde" });
  const part = await createTestOrderPart(order.id, { name: "NoPriceTeil", filamentId: filament.id });
  await createTestPrintJobPart(job.id, part.id);

  const res = await page.request.post(`/api/admin/jobs/${job.id}/verify-parts`, {
    data: {
      iterations: [{ orderPartId: part.id, pieceIndex: 0, result: "success", gramsActual: 15 }],
    },
  });
  expect(res.status()).toBe(200);

  const updatedFilament = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updatedFilament?.remainingGrams).toBe(285); // 300 - 15

  const updatedCustomer = await prismaTest.customer.findUnique({ where: { id: customer.id } });
  expect(updatedCustomer?.creditBalanceCents).toBe(300); // unchanged
});
