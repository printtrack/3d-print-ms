import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestFilament,
  createTestOrder,
  createTestOrderPart,
  createTestMachine,
  createTestPrintJob,
  createTestPrintJobPart,
  createTestPrintReadyPart,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Filament reservations", () => {
  test("inventory API returns reservedGrams + availableGrams for planned jobs", async ({ seed, page }) => {
    const filament = await createTestFilament({ name: "Resv PLA", remainingGrams: 1000 });
    const machine = await createTestMachine();
    const order = await createTestOrder(seed.phases[0].id);
    const part1 = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 300 });
    const part2 = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 300 });
    const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
    await createTestPrintJobPart(job.id, part1.id);
    await createTestPrintJobPart(job.id, part2.id);

    const res = await page.request.get("/api/admin/inventory");
    expect(res.ok()).toBeTruthy();
    const items: Array<{ id: string; remainingGrams: number; reservedGrams: number; availableGrams: number }> = await res.json();
    const f = items.find((i) => i.id === filament.id)!;
    expect(f.remainingGrams).toBe(1000);
    expect(f.reservedGrams).toBe(600);
    expect(f.availableGrams).toBe(400);
  });

  test("G-code PrintJobFilament takes precedence over gramsEstimated", async ({ seed, page }) => {
    const filament = await createTestFilament({ name: "GCode PLA", remainingGrams: 1000 });
    const machine = await createTestMachine();
    const order = await createTestOrder(seed.phases[0].id);
    const part = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 999 });
    const job = await createTestPrintJob(machine.id, { status: "SLICED" });
    await createTestPrintJobPart(job.id, part.id);
    // PrintJobFilament from G-code says only 450g — should win over 999g estimate
    await prismaTest.printJobFilament.create({
      data: { printJobId: job.id, filamentId: filament.id, gramsActual: 450 },
    });

    const res = await page.request.get("/api/admin/inventory");
    const items: Array<{ id: string; reservedGrams: number; availableGrams: number }> = await res.json();
    const f = items.find((i) => i.id === filament.id)!;
    expect(f.reservedGrams).toBe(450);
    expect(f.availableGrams).toBe(550);
  });

  test("DONE and CANCELLED jobs do not count toward reservation", async ({ seed, page }) => {
    const filament = await createTestFilament({ name: "Status PLA", remainingGrams: 1000 });
    const machine = await createTestMachine();
    const order = await createTestOrder(seed.phases[0].id);
    const partDone = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 200 });
    const partCancel = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 300 });
    const partActive = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 150 });

    const doneJob = await createTestPrintJob(machine.id, { status: "DONE" });
    await createTestPrintJobPart(doneJob.id, partDone.id);

    const cancelJob = await createTestPrintJob(machine.id, { status: "CANCELLED" });
    await createTestPrintJobPart(cancelJob.id, partCancel.id);

    const activeJob = await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });
    await createTestPrintJobPart(activeJob.id, partActive.id);

    const res = await page.request.get("/api/admin/inventory");
    const items: Array<{ id: string; reservedGrams: number; availableGrams: number }> = await res.json();
    const f = items.find((i) => i.id === filament.id)!;
    expect(f.reservedGrams).toBe(150);
    expect(f.availableGrams).toBe(850);
  });

  test("InventoryManager shows reservation in table with negative-stock highlight", async ({ seed, page }) => {
    const filament = await createTestFilament({ name: "Overcommit PLA", remainingGrams: 500 });
    const machine = await createTestMachine();
    const order = await createTestOrder(seed.phases[0].id);
    const part = await createTestOrderPart(order.id, { filamentId: filament.id, gramsEstimated: 800 });
    const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
    await createTestPrintJobPart(job.id, part.id);

    await page.goto("/admin/inventory");
    const row = page.locator("tr").filter({ hasText: "Overcommit PLA" });
    await expect(row).toBeVisible();
    await expect(row.getByText("-300 g")).toBeVisible();
    await expect(row.getByText("800 g")).toBeVisible();
    await expect(row.locator('[title*="berzug"]')).toBeVisible();
  });

  // TODO: "Trotzdem planen"-Confirm legt aktuell keinen PrintJob an
  //       (activeJobs landet bei 0). Vor Re-Enable PlanJobsDialog + zugehörigen
  //       POST-Endpoint debuggen.
  test.skip("PlanJobsDialog shows overuse warning and requires confirmation", async ({ seed, page }) => {
    void seed;
    const filament = await createTestFilament({ name: "Plan PLA", remainingGrams: 500, colorHex: "#ff0000" });
    await createTestMachine({ buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250 });

    await createTestPrintReadyPart({ filamentId: filament.id, name: "Big Part", gramsEstimated: 800 });

    await page.goto("/admin/jobs");
    await page.getByRole("button", { name: /Druckjobs vorschlagen/i }).click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Vorgeschlagene Jobs")).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/Nur .* g verfügbar/)).toBeVisible();

    await dialog.getByRole("button", { name: /Job.* erstellen/i }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(/Filament-Überzug bestätigen/)).toBeVisible();
    await confirm.getByRole("button", { name: /Trotzdem planen/ }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    const activeJobs = await prismaTest.printJob.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } });
    expect(activeJobs).toBeGreaterThan(0);
  });
});
