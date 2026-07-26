import { test, expect } from "../fixtures/test-base";
import {
  createTestFilament,
  createTestMachine,
  createTestPrintJob,
  createTestPrintJobPart,
  createTestPrintReadyPart,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// ---------------------------------------------------------------------------
// Happy path — Farbwechsel nimmt das Teil aus dem noch nicht gestarteten Job
// ---------------------------------------------------------------------------

test("nimmt ein Teil bei Farbwechsel aus dem geplanten Job heraus", async ({ seed, page }) => {
  void seed;
  await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Replan A" });

  const { part, order } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Wechselteil" });
  // Zweites Teil, damit der Job nicht leerläuft und wir das Herausnehmen sehen
  const { part: other } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Bleibt drin" });

  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);
  await createTestPrintJobPart(job.id, other.id);

  const res = await page.request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { color: "Blau" },
  });
  expect(res.ok()).toBeTruthy();

  const stillInOldJob = await prismaTest.printJobPart.findFirst({
    where: { printJobId: job.id, orderPartId: part.id },
  });
  expect(stillInOldJob).toBeNull();

  // Das unveränderte Teil bleibt unangetastet
  const untouched = await prismaTest.printJobPart.findFirst({
    where: { printJobId: job.id, orderPartId: other.id },
  });
  expect(untouched).not.toBeNull();

  const log = await prismaTest.auditLog.findFirst({
    where: { orderId: order.id, action: "JOB_REPLANNED" },
  });
  expect(log?.details).toMatch(/Farbe geändert/);
});

test("plant das geänderte Teil automatisch neu ein", async ({ seed, page }) => {
  void seed;
  await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Replan B" });

  const { part, order } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Neu einplanen" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  await page.request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, { data: { color: "Blau" } });
  // Auto-Planung läuft asynchron im Hintergrund — hier deterministisch nachziehen
  const planRes = await page.request.post("/api/admin/jobs/auto-plan");
  expect(planRes.ok()).toBeTruthy();

  const link = await prismaTest.printJobPart.findFirst({
    where: { orderPartId: part.id, printJob: { status: { notIn: ["DONE", "CANCELLED"] } } },
    include: { printJob: true },
  });
  expect(link).not.toBeNull();
  expect(link!.printJobId).not.toBe(job.id);
  // Der neue Job wartet auf die Terminierung — die ist bewusst manuell
  expect(link!.printJob.plannedAt).toBeNull();

  // Der leergelaufene alte Job wurde entfernt
  const oldJob = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(oldJob).toBeNull();
});

// ---------------------------------------------------------------------------
// Fehlerfall / Grenze — laufender Druck wird nicht angefasst
// ---------------------------------------------------------------------------

test("lässt ein Teil im Job wenn der Druck bereits läuft", async ({ seed, page }) => {
  void seed;
  await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Replan C" });

  const { part, order } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Im Druck" });
  const job = await createTestPrintJob(machine.id, {
    status: "IN_PROGRESS",
    startedAt: new Date(),
  });
  await createTestPrintJobPart(job.id, part.id);

  const res = await page.request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { color: "Blau" },
  });
  expect(res.ok()).toBeTruthy();

  const link = await prismaTest.printJobPart.findFirst({
    where: { printJobId: job.id, orderPartId: part.id },
  });
  expect(link).not.toBeNull();
});

test("nimmt ein Teil bei geänderter Druckorientierung aus dem Job", async ({ seed, page }) => {
  void seed;
  await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Replan D" });

  const { part } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Gedreht" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  // 90°-Drehung um X
  const res = await page.request.patch(`/api/admin/parts/${part.id}/orientation`, {
    data: { qx: Math.SQRT1_2, qy: 0, qz: 0, qw: Math.SQRT1_2 },
  });
  expect(res.ok()).toBeTruthy();

  const link = await prismaTest.printJobPart.findFirst({
    where: { printJobId: job.id, orderPartId: part.id },
  });
  expect(link).toBeNull();
});

test("nimmt ein Teil aus dem Job wenn es die Druckbereit-Phase verlässt", async ({ seed, page }) => {
  void seed;
  await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Replan E" });

  const { part, order } = await createTestPrintReadyPart({ material: "PLA", color: "Rot", name: "Zurück ins Design" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const designPhase = await prismaTest.partPhase.findFirst({ where: { isDefault: true } });

  const res = await page.request.patch(`/api/admin/orders/${order.id}/parts/${part.id}`, {
    data: { partPhaseId: designPhase!.id },
  });
  expect(res.ok()).toBeTruthy();

  const link = await prismaTest.printJobPart.findFirst({
    where: { printJobId: job.id, orderPartId: part.id },
  });
  expect(link).toBeNull();
});
