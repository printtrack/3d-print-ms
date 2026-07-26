import { test, expect } from "../fixtures/test-base";
import {
  createTestFilament,
  createTestMachine,
  createTestOrder,
  createTestPlannedFilament,
  createTestPrintJob,
  createTestPrintJobPart,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

/** Mon–Fri 08:00–18:00 — the default working week. */
const WORKWEEK = [1, 2, 3, 4, 5].map((day) => ({ day, startMinutes: 8 * 60, endMinutes: 18 * 60 }));

/** 08:00–18:00 on every day — isolates the time-of-day rule from the weekday. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, startMinutes: 8 * 60, endMinutes: 18 * 60 }));

/** Tomorrow at `hour` local — always inside the visible timeline range. */
function tomorrow(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function enableAttendance(windows = WORKWEEK) {
  await prismaTest.setting.upsert({
    where: { key: "attendance_enabled" },
    create: { key: "attendance_enabled", value: "true" },
    update: { value: "true" },
  });
  await prismaTest.setting.upsert({
    where: { key: "attendance_windows" },
    create: { key: "attendance_windows", value: JSON.stringify(windows) },
    update: { value: JSON.stringify(windows) },
  });
}

async function disableAttendance() {
  await prismaTest.setting.upsert({
    where: { key: "attendance_enabled" },
    create: { key: "attendance_enabled", value: "false" },
    update: { value: "false" },
  });
}

test.afterEach(async () => {
  // Settings survive resetDb() — leave the suite in the default state.
  await disableAttendance();
});

test("terminiert einen Job mit Filamentwechsel nur in eine Anwesenheitszeit", async ({ seed, page }) => {
  void seed;
  await enableAttendance();
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  // PLA steckt drin, der Job braucht PETG → jemand muss wechseln
  const machine = await createTestMachine({ name: "Wechsel nötig", loadedFilamentIds: [pla.id] });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });
  await createTestPlannedFilament(job.id, petg.id);

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findFirst({ where: { machineId: machine.id } });
  const start = after!.plannedAt!;
  const minutes = start.getHours() * 60 + start.getMinutes();
  expect([1, 2, 3, 4, 5]).toContain(start.getDay());
  expect(minutes).toBeGreaterThanOrEqual(8 * 60);
  expect(minutes).toBeLessThan(18 * 60);
});

test("darf einen Job ohne Filamentwechsel auch unbeaufsichtigt starten", async ({ seed, page }) => {
  void seed;
  // Nur ein schmales Fenster heute/morgen — ohne Wechsel muss der Job nicht darauf warten
  await enableAttendance(EVERY_DAY);
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Remote-Start", loadedFilamentIds: [pla.id] });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });
  await createTestPlannedFilament(job.id, pla.id);

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  // Frühestmöglich (30 min Vorlauf), unabhängig von der Uhrzeit
  expect(after!.plannedAt!.getTime()).toBeLessThan(Date.now() + 2 * 3_600_000);
});

test("lässt einen Druck über Nacht laufen, blockiert den Drucker aber bis zur Entnahme", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const machine = await createTestMachine({ name: "Über Nacht" });

  // Job 1 startet morgen 16:00 und druckt 4 h → fertig um 20:00, niemand mehr da
  const start1 = tomorrow(16);
  const end1 = new Date(start1.getTime() + 240 * 60_000);
  const pickup = new Date(start1.getFullYear(), start1.getMonth(), start1.getDate() + 1, 8, 0, 0);
  await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: start1, printTimeMinutes: 240 });

  const second = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: second.id } });
  const start2 = after!.plannedAt!.getTime();
  const end2 = start2 + 60 * 60_000;

  // Entweder komplett vor Job 1 — oder erst nach der Entnahme. Die Nacht
  // dazwischen gehört der belegten Platte, obwohl der Druck da schon fertig ist.
  const beforeJob1 = end2 <= start1.getTime();
  const afterPickup = start2 >= pickup.getTime();
  expect(
    beforeJob1 || afterPickup,
    `Job 2 startet ${new Date(start2).toISOString()} — Druckende Job 1 ${end1.toISOString()}, Entnahme ${pickup.toISOString()}`
  ).toBe(true);
  // Die Uhrzeit selbst ist frei — Drucke lassen sich remote starten, nur die
  // Entnahme braucht jemanden vor Ort.
});

test("plant ohne Anwesenheitszeiten weiterhin rund um die Uhr", async ({ seed, page }) => {
  void seed;
  await disableAttendance();
  const machine = await createTestMachine({ name: "Rund um die Uhr" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });

  const res = await page.request.post("/api/admin/jobs/schedule");
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  // 30 min Vorlauf, sonst keine Einschränkung
  expect(after!.plannedAt!.getTime()).toBeLessThan(Date.now() + 2 * 3_600_000);
});

test("zeigt Bänder für unbetreute Zeiten auf der Zeitachse", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  await createTestMachine({ name: "Bänder" });

  await page.goto("/admin/jobs");
  await expect(page.getByTestId("timeline-unattended-band").first()).toBeVisible();
});

test("zeigt Rüstzeit und Wartezeit als Schraffur am Job", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Schraffur", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PETG Teil" } });
  // Start 16:00 + 2,5 h → Druckende 18:30, also nach Feierabend:
  // Entnahme erst am nächsten Morgen, der Drucker bleibt so lange belegt.
  const job = await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: tomorrow(16),
    printTimeMinutes: 150,
  });
  await createTestPrintJobPart(job.id, part.id);
  await prismaTest.printJobPlannedFilament.create({ data: { printJobId: job.id, filamentId: petg.id } });

  await page.goto("/admin/jobs");
  // Die Gantt-Ansicht misst ihre Breite erst nach dem Mount — großzügig warten.
  await expect(page.getByTestId("timeline-setup-block")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("timeline-pickup-block")).toBeVisible({ timeout: 15_000 });
});

test("hakt Filamentwechsel über die Sammelliste ab", async ({ seed, page }) => {
  void seed;
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Sammelliste", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PETG Teil" } });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);
  await prismaTest.printJobPlannedFilament.create({ data: { printJobId: job.id, filamentId: petg.id } });

  await page.goto("/admin/jobs");
  await page.getByTestId("filament-changes-btn").click();

  const list = page.getByTestId("filament-change-list");
  await expect(list).toContainText("PLA Rot");
  await expect(list).toContainText("PETG Blau");

  await list.getByRole("button", { name: /Wechsel erledigt/i }).click();
  await expect(page.getByText(/bestätigt/i).first()).toBeVisible({ timeout: 10_000 });

  const slots = await prismaTest.machineFilamentSlot.findMany({ where: { machineId: machine.id } });
  expect(slots.map((s) => s.filamentId)).toEqual([petg.id]);
});

test("speichert Anwesenheitszeiten über die Einstellungen", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/settings?tab=anwesenheit");
  await page.getByTestId("attendance-enabled").click();
  await page.getByTestId("attendance-save").click();
  await expect(page.getByText(/gespeichert/i).first()).toBeVisible({ timeout: 10_000 });

  const setting = await prismaTest.setting.findUnique({ where: { key: "attendance_enabled" } });
  expect(setting?.value).toBe("true");
  const windows = await prismaTest.setting.findUnique({ where: { key: "attendance_windows" } });
  expect(JSON.parse(windows!.value).length).toBeGreaterThan(0);
});

test("verweigert das Speichern der Anwesenheitszeiten für Nicht-Admins", async ({ seed, browser }) => {
  void seed;
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await context.request.patch("/api/admin/settings", {
    data: { attendance_enabled: "true" },
  });
  expect([401, 403]).toContain(res.status());
  await context.close();
});

// ---------------------------------------------------------------------------
// Manuelles Verschieben respektiert dieselben Regeln wie die Planung
// ---------------------------------------------------------------------------

test("lehnt das Verschieben in die Nacht ab, wenn ein Filamentwechsel aussteht", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Nachtverbot", loadedFilamentIds: [pla.id] });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });
  await createTestPlannedFilament(job.id, petg.id);

  const night = tomorrow(2); // 02:00 — niemand kann die Spule wechseln
  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { plannedAt: night.toISOString() },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).error).toMatch(/Filamentwechsel/);

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.plannedAt).toBeNull();
});

test("erlaubt einen Nachtstart, wenn das Filament schon geladen ist", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Nacht erlaubt", loadedFilamentIds: [pla.id] });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });
  await createTestPlannedFilament(job.id, pla.id);

  const night = tomorrow(2);
  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { plannedAt: night.toISOString() },
  });
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.plannedAt!.getTime()).toBe(night.getTime());
});

test("lehnt das Verschieben in die Vergangenheit ab", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const machine = await createTestMachine({ name: "Keine Rückdatierung" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });

  const past = new Date(Date.now() - 3 * 3_600_000);
  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { plannedAt: past.toISOString() },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).error).toMatch(/Vergangenheit/);
});

test("erlaubt das Verschieben in eine betreute Zeit", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const machine = await createTestMachine({ name: "Erlaubt" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });

  const slot = tomorrow(10);
  const res = await page.request.patch(`/api/admin/jobs/${job.id}`, {
    data: { plannedAt: slot.toISOString() },
  });
  expect(res.ok()).toBeTruthy();

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.plannedAt!.getTime()).toBe(slot.getTime());
});

test("rechnet die Belegung bis zur Entnahme, nicht nur bis zum Druckende", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const machine = await createTestMachine({ name: "Platte belegt" });
  // Läuft morgen 16:00–18:30 → Druckende nach Feierabend, Entnahme übermorgen 08:00
  await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: tomorrow(16),
    printTimeMinutes: 150,
  });
  const second = await createTestPrintJob(machine.id, { status: "PLANNED", printTimeMinutes: 60 });

  // Genau zur Entnahme ist der Drucker wieder frei
  const pickup = new Date(tomorrow(16));
  pickup.setDate(pickup.getDate() + 1);
  pickup.setHours(8, 0, 0, 0);
  const ok = await page.request.patch(`/api/admin/jobs/${second.id}`, {
    data: { plannedAt: pickup.toISOString() },
  });
  expect(ok.ok()).toBeTruthy();

  // Währenddessen bleibt er belegt
  const during = await page.request.patch(`/api/admin/jobs/${second.id}`, {
    data: { plannedAt: tomorrow(17).toISOString() },
  });
  expect(during.status()).toBe(409);
});

test("schließt einen Druck ohne hinterlegte Druckzeit automatisch ab", async ({ seed, page }) => {
  void seed;
  await disableAttendance();
  const machine = await createTestMachine({ name: "Ohne Druckzeit" });
  // Läuft seit drei Stunden, keine Druckzeit erfasst → Standarddauer 2 h ist um
  const job = await createTestPrintJob(machine.id, {
    status: "IN_PROGRESS",
    startedAt: new Date(Date.now() - 3 * 3_600_000),
  });

  const res = await page.request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();
  const { completed } = await res.json();
  expect(completed).toContain(job.id);

  const after = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(after!.status).toBe("AWAITING_VERIFICATION");
});

test("zeigt die Schraffuren auch in der Monatsansicht", async ({ seed, page }) => {
  void seed;
  await enableAttendance(EVERY_DAY);
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Zoomstufen", loadedFilamentIds: [pla.id] });

  const order = await createTestOrder(seed.phases[0].id);
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "PETG Teil" } });
  const job = await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: tomorrow(16),
    printTimeMinutes: 150, // endet 18:30 → Entnahme am Folgetag
  });
  await createTestPrintJobPart(job.id, part.id);
  await prismaTest.printJobPlannedFilament.create({ data: { printJobId: job.id, filamentId: petg.id } });

  await page.goto("/admin/jobs");
  await expect(page.getByTestId("timeline-setup-block")).toBeVisible({ timeout: 15_000 });

  // Ausgezoomt sind 15 Minuten Rüstzeit unter einem Pixel breit — die Markierung
  // muss trotzdem sichtbar bleiben (Mindestbreite).
  await page.getByRole("button", { name: "Monat", exact: true }).click();
  await expect(page.getByTestId("timeline-setup-block")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("timeline-pickup-block")).toBeVisible();
});
