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

  // Der Auto-Planer plant auch bei Materialmangel — die Produktion soll nicht
  // still stehen; der Überzug wird stattdessen im Inventar sichtbar gemacht.
  test("plans despite filament shortage and flags the overcommit in the inventory", async ({ seed, page }) => {
    void seed;
    const filament = await createTestFilament({ name: "Plan PLA", remainingGrams: 500, colorHex: "#ff0000" });
    await createTestMachine({ buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250 });

    await createTestPrintReadyPart({ filamentId: filament.id, name: "Big Part", gramsEstimated: 800 });

    const res = await page.request.post("/api/admin/jobs/auto-plan");
    expect(res.ok()).toBeTruthy();

    const activeJobs = await prismaTest.printJob.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } });
    expect(activeJobs).toBeGreaterThan(0);

    const inv = await page.request.get("/api/admin/inventory");
    const items: Array<{ id: string; availableGrams: number }> = await inv.json();
    expect(items.find((i) => i.id === filament.id)!.availableGrams).toBe(-300);
  });
});
