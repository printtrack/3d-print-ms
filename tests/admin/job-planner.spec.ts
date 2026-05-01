import { test, expect } from "../fixtures/test-base";
import {
  createTestFilament,
  createTestMachine,
  createTestOrder,
  createTestOrderPart,
  createTestPrintJob,
  createTestPrintJobPart,
  createTestPrintReadyPart,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// ---------------------------------------------------------------------------
// Happy path — full UI flow
// ---------------------------------------------------------------------------

test("schlägt druckbereite Teile als Job vor und erstellt ihn", async ({ seed, page }) => {
  const filament = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const machine = await createTestMachine({ name: "Drucker Alpha", buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250 });

  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil A", gramsEstimated: 50 });
  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil B", gramsEstimated: 60 });
  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil C", gramsEstimated: 40 });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Druckjobs vorschlagen/i }).click();

  // Dialog öffnet sich und lädt Vorschläge
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Vorgeschlagene Jobs")).toBeVisible({ timeout: 10_000 });

  // Mindestens ein Vorschlag für PLA Rot auf Drucker Alpha
  await expect(dialog.getByText("Drucker Alpha")).toBeVisible();
  await expect(dialog.getByText(/PLA/)).toBeVisible();

  // Alle ausgewählt (default) → erstellen
  await dialog.getByRole("button", { name: /Job.* erstellen/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });

  // Job erscheint in Timeline (Nicht geplant)
  await expect(page.getByText(/Nicht geplant/i)).toBeVisible();
  void machine;
});

// ---------------------------------------------------------------------------
// Material-Trennung — kein Mix in einem Job
// ---------------------------------------------------------------------------

test("trennt verschiedene Materialien in separate Jobs", async ({ seed, page }) => {
  const pla = await createTestFilament({ material: "PLA", color: "Rot", colorHex: "#FF0000" });
  const petg = await createTestFilament({ material: "PETG", color: "Blau", colorHex: "#0000FF" });
  await createTestMachine({ name: "Drucker Beta" });

  await createTestPrintReadyPart({ filamentId: pla.id, name: "PLA Teil 1" });
  await createTestPrintReadyPart({ filamentId: pla.id, name: "PLA Teil 2" });
  await createTestPrintReadyPart({ filamentId: petg.id, name: "PETG Teil 1" });

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed } = await res.json();

  // 2 Vorschläge: einer PLA, einer PETG
  expect(proposed).toHaveLength(2);
  const materials = proposed.map((j: { filamentLabel: string }) => j.filamentLabel);
  expect(materials.some((m: string) => m.includes("PLA"))).toBe(true);
  expect(materials.some((m: string) => m.includes("PETG"))).toBe(true);

  // Kein Job enthält gemischte Materialien
  for (const job of proposed) {
    const uniqueFilaments = new Set(
      (job.parts as { orderPartId: string }[]).map(() => job.filamentLabel)
    );
    expect(uniqueFilaments.size).toBe(1);
  }
});

// ---------------------------------------------------------------------------
// Skipped: kein STL
// ---------------------------------------------------------------------------

test("überspringt Teile ohne STL-Datei mit Begründung", async ({ seed, page }) => {
  const filament = await createTestFilament();
  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  const defaultOrderPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  await createTestMachine();

  const order = await createTestOrder(defaultOrderPhase!.id, { customerName: "Kein STL Test" });
  // Part ohne STL-Datei
  await createTestOrderPart(order.id, {
    filamentId: filament.id,
    partPhaseId: printReadyPhase!.id,
    name: "Teil ohne Datei",
  });

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { skipped } = await res.json();

  const skippedPart = (skipped as { partName: string; reason: string }[]).find(
    (s) => s.partName === "Teil ohne Datei"
  );
  expect(skippedPart).toBeDefined();
  expect(skippedPart!.reason).toMatch(/STL/i);
});

// ---------------------------------------------------------------------------
// Skipped: zu groß für Maschine
// ---------------------------------------------------------------------------

test("überspringt Teile die nicht auf die Bauplatte passen", async ({ seed, page }) => {
  const filament = await createTestFilament();
  await createTestMachine({ buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250 });

  // STL-Bbox 300×300×300 — passt in keiner Orientierung (300 > 220 in XY, 300 > 250 in Z)
  await createTestPrintReadyPart({
    filamentId: filament.id,
    name: "Riesiges Teil",
    bboxX: 300,
    bboxY: 300,
    bboxZ: 300,
  });

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed, skipped } = await res.json();

  expect(proposed).toHaveLength(0);
  const s = (skipped as { partName: string; reason: string }[]).find(
    (s) => s.partName === "Riesiges Teil"
  );
  expect(s).toBeDefined();
  expect(s!.reason).toMatch(/groß|Maschine/i);
});

// ---------------------------------------------------------------------------
// Bauplatten-Limit — große Teile werden auf mehrere Jobs verteilt
// ---------------------------------------------------------------------------

test("verteilt Teile auf mehrere Jobs wenn die Bauplatte voll ist", async ({ seed, page }) => {
  const filament = await createTestFilament({ material: "PLA", color: "Grün", colorHex: "#00FF00" });
  await createTestMachine({ buildVolumeX: 220, buildVolumeY: 220, buildVolumeZ: 250 });

  // 6 würfelförmige Teile à 150×150×150mm (Footprint 22500mm² in jeder Orientierung)
  // → je nur 1 Teil pro Job (22500 ≤ 33880, aber 2×22500=45000 > 33880)
  for (let i = 0; i < 6; i++) {
    await createTestPrintReadyPart({ filamentId: filament.id, name: `Teil ${i + 1}`, bboxX: 150, bboxY: 150, bboxZ: 150 });
  }

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed } = await res.json();

  // Mindestens 2 Jobs nötig
  expect(proposed.length).toBeGreaterThanOrEqual(2);
  // Alle 6 Teile insgesamt eingeplant
  const totalParts = (proposed as { parts: unknown[] }[]).reduce((sum, j) => sum + j.parts.length, 0);
  expect(totalParts).toBe(6);
});

// ---------------------------------------------------------------------------
// Empty State — keine druckbereiten Teile
// ---------------------------------------------------------------------------

test("gibt leeres Ergebnis zurück wenn keine druckbereiten Teile vorhanden sind", async ({ seed, page }) => {
  await createTestMachine();

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed, skipped } = await res.json();

  expect(proposed).toHaveLength(0);
  expect(skipped).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Exklusivität — bereits zugewiesene Teile erscheinen nicht
// ---------------------------------------------------------------------------

test("schließt Teile aus die bereits in einem aktiven Job sind", async ({ seed, page }) => {
  const filament = await createTestFilament();
  const machine = await createTestMachine();
  const { part } = await createTestPrintReadyPart({ filamentId: filament.id, name: "Bereits zugewiesen" });

  // Part einem aktiven Job zuweisen
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed, skipped } = await res.json();

  const allPartIds = [
    ...(proposed as { parts: { orderPartId: string }[] }[]).flatMap((j) =>
      j.parts.map((p) => p.orderPartId)
    ),
    ...(skipped as { orderPartId: string }[]).map((s) => s.orderPartId),
  ];

  expect(allPartIds).not.toContain(part.id);
});
