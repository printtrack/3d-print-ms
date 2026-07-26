import { test, expect } from "../fixtures/test-base";
import {
  createTestFilament,
  createTestMachine,
  createTestOrder,
  createTestPlannedFilament,
  createTestPrintJob,
  createTestPrintJobPart,
  createTestPrintReadyPart,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// ---------------------------------------------------------------------------
// Bündeln ist automatisch, Terminieren nicht
// ---------------------------------------------------------------------------

test("bündelt Teile automatisch, lässt sie aber unterminiert", async ({ seed, page }) => {
  void seed;
  const filament = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Ohne Termin" });
  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil A" });

  await page.goto("/admin/jobs");

  const jobs = await prismaTest.printJob.findMany({ where: { machineId: machine.id } });
  expect(jobs).toHaveLength(1);
  expect(jobs[0].plannedAt).toBeNull();
});

test("Button terminiert die Jobs auf der Zeitachse", async ({ seed, page }) => {
  void seed;
  const filament = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Mit Termin" });
  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil A" });

  await page.goto("/admin/jobs");
  await page.getByTestId("auto-schedule-btn").click();
  await expect(page.getByText(/terminiert/i).first()).toBeVisible({ timeout: 10_000 });

  const jobs = await prismaTest.printJob.findMany({ where: { machineId: machine.id } });
  expect(jobs[0].plannedAt).not.toBeNull();
  // Vorlauf: nichts startet sofort
  expect(jobs[0].plannedAt!.getTime()).toBeGreaterThan(Date.now());
});

test("verschiebt bereits terminierte Jobs nicht", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Manuell" });
  const fixed = new Date(Date.now() + 5 * 86_400_000);
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: fixed });

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.plannedAt!.getTime()).toBe(fixed.getTime());
});

// ---------------------------------------------------------------------------
// Reihenfolge: Frist zuerst, Filament als Tiebreaker
// ---------------------------------------------------------------------------

test("zieht Jobs mit dem geladenen Filament vor, wenn die Fristen ähnlich sind", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  // Drucker hat bereits PETG Blau geladen
  const machine = await createTestMachine({ name: "Rüstzeit", loadedFilamentIds: [petg.id] });

  const phase = seed.phases[0];
  // Beide Fristen im selben Dringlichkeitsfenster (< 48 h auseinander)
  const orderA = await createTestOrder(phase.id, {
    customerName: "PLA Kunde",
    deadline: new Date(Date.now() + 86_400_000),
  });
  const orderB = await createTestOrder(phase.id, {
    customerName: "PETG Kunde",
    deadline: new Date(Date.now() + 2 * 86_400_000),
  });

  const partA = await prismaTest.orderPart.create({ data: { orderId: orderA.id, name: "PLA Teil" } });
  const partB = await prismaTest.orderPart.create({ data: { orderId: orderB.id, name: "PETG Teil" } });

  const jobPla = await createTestPrintJob(machine.id, { status: "PLANNED", queuePosition: 0 });
  await createTestPrintJobPart(jobPla.id, partA.id);
  await createTestPlannedFilament(jobPla.id, pla.id);

  const jobPetg = await createTestPrintJob(machine.id, { status: "PLANNED", queuePosition: 1 });
  await createTestPrintJobPart(jobPetg.id, partB.id);
  await createTestPlannedFilament(jobPetg.id, petg.id);

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const [first, second] = await prismaTest.printJob.findMany({
    where: { machineId: machine.id },
    orderBy: { plannedAt: "asc" },
  });
  // PETG läuft zuerst, obwohl PLA die frühere Frist hat — kein Wechsel nötig
  expect(first.id).toBe(jobPetg.id);
  expect(second.id).toBe(jobPla.id);
});

// ---------------------------------------------------------------------------
// Filamentwechsel: Erkennung, Bestätigung, Start-Sperre
// ---------------------------------------------------------------------------

test("markiert den Job als Filamentwechsel und startet ihn nicht ohne Bestätigung", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Wechsel", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PETG Teil" } });

  // Fällig: plannedAt in der Vergangenheit → würde normalerweise sofort starten
  const job = await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: new Date(Date.now() - 60_000),
  });
  await createTestPrintJobPart(job.id, part.id);
  await createTestPlannedFilament(job.id, petg.id);

  const res = await page.request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();
  const { started, deferred } = await res.json();
  expect(started).not.toContain(job.id);
  expect(deferred).toContain(job.id);

  const afterDefer = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(afterDefer!.status).toBe("PLANNED");
  expect(afterDefer!.plannedAt!.getTime()).toBeGreaterThan(Date.now());

  // Wechsel bestätigen → Slots der Maschine werden übernommen
  const confirm = await page.request.post(`/api/admin/jobs/${job.id}/filament-change`);
  expect(confirm.ok()).toBeTruthy();

  const slots = await prismaTest.machineFilamentSlot.findMany({ where: { machineId: machine.id } });
  expect(slots.map((s) => s.filamentId)).toEqual([petg.id]);

  const confirmed = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(confirmed!.filamentChangeConfirmedAt).not.toBeNull();

  // Nach Bestätigung startet der Job zum Termin
  await prismaTest.printJob.update({
    where: { id: job.id },
    data: { plannedAt: new Date(Date.now() - 60_000) },
  });
  const second = await page.request.post("/api/admin/jobs/auto-transition");
  const { started: started2 } = await second.json();
  expect(started2).toContain(job.id);
});

test("verlangt keinen Wechsel wenn das Filament bereits geladen ist", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Passend", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PLA Teil" } });
  const job = await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: new Date(Date.now() - 60_000),
  });
  await createTestPrintJobPart(job.id, part.id);
  await createTestPlannedFilament(job.id, pla.id);

  const res = await page.request.post("/api/admin/jobs/auto-transition");
  const { started, deferred } = await res.json();
  expect(deferred).not.toContain(job.id);
  expect(started).toContain(job.id);
});

test("zeigt den offenen Filamentwechsel im Job-Board", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Wechseldrucker", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PETG Teil" } });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);
  await createTestPlannedFilament(job.id, petg.id);

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: "Board", exact: true }).click();

  await expect(page.getByTestId("filament-change-badge").first()).toBeVisible();

  // Im Job-Detail steht, was zu tun ist — inklusive der Spule, die runter muss
  await page.getByText("Test Customer").first().click();
  const panel = page.getByTestId("filament-change-panel");
  await expect(panel).toContainText("PLA Rot");
  await expect(panel).toContainText("PETG Blau");
});

test("verlangt eine Session für die Terminierung", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await context.request.post("/api/admin/jobs/schedule");
  expect(res.status()).toBe(401);
  await context.close();
});

// ---------------------------------------------------------------------------
// Multi-Material-Drucker
// ---------------------------------------------------------------------------

test("legt auf Einzelextruder-Druckern nur ein Filament pro Job", async ({ seed, page }) => {
  void seed;
  const red = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const blue = await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  await createTestMachine({ name: "Einzel", buildVolumeX: 250, buildVolumeY: 250, buildVolumeZ: 250 });

  await createTestPrintReadyPart({ filamentId: red.id, name: "Rot", bboxX: 30, bboxY: 30, bboxZ: 30 });
  await createTestPrintReadyPart({ filamentId: blue.id, name: "Blau", bboxX: 30, bboxY: 30, bboxZ: 30 });

  const res = await page.request.post("/api/admin/jobs/plan");
  const { proposed } = await res.json();

  expect(proposed).toHaveLength(2);
  for (const job of proposed as { filamentIds: string[] }[]) {
    expect(job.filamentIds).toHaveLength(1);
  }
});

test("bündelt zwei geladene Farben in einen Job auf einem Multi-Material-Drucker", async ({ seed, page }) => {
  void seed;
  const red = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const blue = await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  await createTestMachine({
    name: "AMS",
    buildVolumeX: 250,
    buildVolumeY: 250,
    buildVolumeZ: 250,
    materialSlots: 4,
    // Beide Spulen stecken im Drucker — der Job braucht keinen Wechsel
    loadedFilamentIds: [red.id, blue.id],
  });

  await createTestPrintReadyPart({ filamentId: red.id, name: "Rot", bboxX: 30, bboxY: 30, bboxZ: 30 });
  await createTestPrintReadyPart({ filamentId: blue.id, name: "Blau", bboxX: 30, bboxY: 30, bboxZ: 30 });

  const res = await page.request.post("/api/admin/jobs/plan");
  const { proposed } = await res.json();

  expect(proposed).toHaveLength(1);
  expect(proposed[0].filamentIds).toHaveLength(2);
  expect(proposed[0].parts).toHaveLength(2);
});

test("legt nicht geladene Farben getrennt, auch auf einem Multi-Material-Drucker", async ({ seed, page }) => {
  void seed;
  const red = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const blue = await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  // Nur Rot steckt drin — Blau würde ohnehin einen Wechsel kosten, also kein Merge
  await createTestMachine({
    name: "AMS halb bestückt",
    buildVolumeX: 250,
    buildVolumeY: 250,
    buildVolumeZ: 250,
    materialSlots: 4,
    loadedFilamentIds: [red.id],
  });

  await createTestPrintReadyPart({ filamentId: red.id, name: "Rot", bboxX: 30, bboxY: 30, bboxZ: 30 });
  await createTestPrintReadyPart({ filamentId: blue.id, name: "Blau", bboxX: 30, bboxY: 30, bboxZ: 30 });

  const res = await page.request.post("/api/admin/jobs/plan");
  const { proposed } = await res.json();

  expect(proposed).toHaveLength(2);
  for (const job of proposed as { filamentIds: string[] }[]) {
    expect(job.filamentIds).toHaveLength(1);
  }
});

test("bevorzugt den Drucker, in dem die Spule bereits steckt", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Grün", colorHex: "#00FF00" });
  // Alphabetisch zuerst, aber ohne passende Spule
  await createTestMachine({ name: "A Leer", buildVolumeX: 250, buildVolumeY: 250, buildVolumeZ: 250 });
  const loaded = await createTestMachine({
    name: "B Bestückt",
    buildVolumeX: 250,
    buildVolumeY: 250,
    buildVolumeZ: 250,
    loadedFilamentIds: [pla.id],
  });

  await createTestPrintReadyPart({ filamentId: pla.id, name: "Teil", bboxX: 30, bboxY: 30, bboxZ: 30 });

  const res = await page.request.post("/api/admin/jobs/plan");
  const { proposed } = await res.json();

  expect(proposed).toHaveLength(1);
  expect(proposed[0].machineId).toBe(loaded.id);
});

// ---------------------------------------------------------------------------
// Manuelles Verschieben — die Planungsregeln gelten auch von Hand
// ---------------------------------------------------------------------------

test("verhindert das Verschieben auf einen zu kleinen Drucker", async ({ seed, page }) => {
  void seed;
  const filament = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const big = await createTestMachine({ name: "Groß", buildVolumeX: 400, buildVolumeY: 400, buildVolumeZ: 400 });
  const small = await createTestMachine({ name: "Klein", buildVolumeX: 100, buildVolumeY: 100, buildVolumeZ: 200 });

  const { part } = await createTestPrintReadyPart({
    filamentId: filament.id,
    name: "Großes Teil",
    bboxX: 300,
    bboxY: 280,
    bboxZ: 260,
  });
  // Vermessen ist der Zustand nach einem Planerlauf — darauf stützt sich die Prüfung
  await prismaTest.orderPart.update({
    where: { id: part.id },
    data: { bboxXmm: 300, bboxYmm: 280, bboxZmm: 260 },
  });
  const job = await createTestPrintJob(big.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { machineId: small.id },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).error).toMatch(/Bauraum/);

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.machineId).toBe(big.id);
});

test("liefert die geplanten Spulen mit, damit die Anzeige nach dem Verschieben stimmt", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Verschieben" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPlannedFilament(job.id, pla.id);

  // Der Client ersetzt den Job im State durch genau diese Antwort — fehlen die
  // Spulen darin, verschwinden Filamentwechsel-Markierung und Schraffur.
  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { plannedAt: new Date(Date.now() + 3 * 86_400_000).toISOString() },
  });
  expect(res.ok()).toBeTruthy();
  // Die Route antwortet mit { job, warnings } — der Client übernimmt `job` in den State
  const { job: updated } = await res.json();
  expect(updated.plannedFilaments).toHaveLength(1);
  expect(updated.plannedFilaments[0].filamentId).toBe(pla.id);
  expect(updated).toHaveProperty("filamentChangeConfirmedAt");
});
