import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestMachine,
  createTestPrintJob,
  createTestPrintJobFile,
  createTestOrder,
  createTestOrderPart,
  createTestPrintJobPart,
  createTestOrderWithStlFile,
  createTestFilament,
} from "../fixtures/db";

const GCODE_BUFFER = Buffer.from("; G-Code\nG28\n");

test.use({ storageState: "tests/.auth/admin.json" });

test("shows 'keine Maschinen' state when no active machines", async ({ seed, page }) => {
  await page.goto("/admin/jobs");
  await expect(page.getByText("Keine Maschinen konfiguriert")).toBeVisible();
});

test("shows machine columns when machines exist", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Alpha" });
  await page.goto("/admin/jobs");
  await expect(page.getByText("Drucker Alpha")).toBeVisible();
});

test("creates a new print job via column button and auto-opens detail dialog", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Beta" });
  await page.goto("/admin/jobs");
  await page.getByText("Drucker Beta").waitFor();
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("Drucker Beta").waitFor();

  await page.getByRole("button", { name: /\+ Job/i }).click();

  // Create dialog appears — machine pre-selected
  await expect(page.getByText("Neuer Druckjob")).toBeVisible();
  await page.getByRole("button", { name: /^Erstellen$/i }).click();

  await expect(page.getByText("Druckjob erstellt").first()).toBeVisible();

  // Detail dialog should open automatically after creation
  await expect(page.getByText(/Druckjob — Drucker Beta/)).toBeVisible();
  await expect(page.getByText("Keine Teile zugewiesen")).toBeVisible();
});

test("opens job detail dialog on card click", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Gamma" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Gamma/)).toBeVisible();
});

test("changes job status to IN_PROGRESS", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Delta" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Delta/)).toBeVisible();

  // Change status
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Im Druck" }).click();
  await page.getByRole("button", { name: /Änderungen speichern/i }).click();

  await expect(page.getByText("Job aktualisiert").first()).toBeVisible();
});

test("deletes a planned job from detail dialog", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Epsilon" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });
  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();

  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Epsilon/)).toBeVisible();

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Job löschen/i }).click();

  await expect(page.getByText("Job gelöscht").first()).toBeVisible();
});

test("order detail part badge links to correct job via ?jobId=", async ({ seed, page }) => {
  const allPhases = await prismaTest.orderPhase.findMany();
  const phase = allPhases[0];
  const order = await createTestOrder(phase.id);
  const machine = await createTestMachine({ name: "Badge-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  const part = await prismaTest.orderPart.create({ data: { orderId: order.id, name: "Badge Teil" } });
  await prismaTest.printJobPart.create({ data: { printJobId: job.id, orderPartId: part.id } });

  await page.goto(`/admin/orders/${order.id}`);
  const badge = page.getByRole("link", { name: "Badge-Drucker" });
  await expect(badge).toBeVisible({ timeout: 8000 });
  const href = await badge.getAttribute("href");
  expect(href).toContain(`jobId=${job.id}`);
});

// --- Auto-transition API tests ---

test("auto-transition: PLANNED → IN_PROGRESS when plannedAt is in the past", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker 1" });
  const pastTime = new Date(Date.now() - 5 * 60_000); // 5 minutes ago
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: pastTime });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.started).toContain(job.id);
  expect(body.completed).not.toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("IN_PROGRESS");
  expect(updated?.startedAt).not.toBeNull();
});

test("auto-transition: IN_PROGRESS → DONE when print time has elapsed", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker 2" });
  const startedAt = new Date(Date.now() - 10 * 60_000); // started 10 minutes ago
  const job = await createTestPrintJob(machine.id, {
    status: "IN_PROGRESS",
    plannedAt: startedAt,
    startedAt,
    printTimeMinutes: 5, // only 5 minutes needed → elapsed
  });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.completed).toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("DONE");
  expect(updated?.completedAt).not.toBeNull();
});

test("auto-transition: does not touch PLANNED jobs whose plannedAt is in the future", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker 3" });
  const futureTime = new Date(Date.now() + 60 * 60_000); // 1 hour from now
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: futureTime });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.started).not.toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("PLANNED");
});

test("auto-transition: does not auto-complete IN_PROGRESS job without printTimeMinutes", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker 4" });
  const startedAt = new Date(Date.now() - 10 * 60_000);
  const job = await createTestPrintJob(machine.id, {
    status: "IN_PROGRESS",
    plannedAt: startedAt,
    startedAt,
    // no printTimeMinutes
  });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.completed).not.toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("IN_PROGRESS");
});

test("auto-transition: does not touch CANCELLED jobs", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker 5" });
  const pastTime = new Date(Date.now() - 5 * 60_000);
  const job = await createTestPrintJob(machine.id, { status: "CANCELLED", plannedAt: pastTime });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.started).not.toContain(job.id);
  expect(body.completed).not.toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("CANCELLED");
});

test("auto-transition: writes audit log entries for started jobs", async ({ request }) => {
  const allPhases = await prismaTest.orderPhase.findMany();
  const phase = allPhases[0];
  const machine = await createTestMachine({ name: "Auto-Drucker 6" });
  const order = await createTestOrder(phase.id);
  const pastTime = new Date(Date.now() - 5 * 60_000);
  const job = await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: pastTime });

  // Link order part to job
  const part = await createTestOrderPart(order.id, { name: "Test Teil" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const logs = await prismaTest.auditLog.findMany({ where: { orderId: order.id, action: "JOB_STARTED" } });
  expect(logs.length).toBeGreaterThan(0);
  expect(logs[0].details).toContain("automatisch");
  expect(logs[0].userId).toBeNull();
});

test("auto-transition: returns a JSON response with started and completed arrays", async ({ request }) => {
  // No jobs → both arrays empty, verifies endpoint shape
  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.started)).toBeTruthy();
  expect(Array.isArray(body.completed)).toBeTruthy();
});

// --- SLICED status tests ---

test("auto-transition: SLICED → IN_PROGRESS when plannedAt is in the past", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker Sliced" });
  const pastTime = new Date(Date.now() - 5 * 60_000);
  const job = await createTestPrintJob(machine.id, { status: "SLICED", plannedAt: pastTime });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.started).toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("IN_PROGRESS");
  expect(updated?.startedAt).not.toBeNull();
});

test("auto-transition: SLICED job in the future is not started", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Drucker Sliced Future" });
  const futureTime = new Date(Date.now() + 60 * 60_000);
  const job = await createTestPrintJob(machine.id, { status: "SLICED", plannedAt: futureTime });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const body = await res.json();
  expect(body.started).not.toContain(job.id);

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("SLICED");
});

// --- Slice file upload tests ---

test("slice file upload: auto-transitions PLANNED job to SLICED", async ({ request }) => {
  const machine = await createTestMachine({ name: "Upload-Drucker 1" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: {
        name: "test.gcode",
        mimeType: "application/octet-stream",
        buffer: GCODE_BUFFER,
      },
    },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("SLICED");
});

test("slice file upload: does not change status of non-PLANNED job", async ({ request }) => {
  const machine = await createTestMachine({ name: "Upload-Drucker 2" });
  const job = await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: {
        name: "test.gcode",
        mimeType: "application/octet-stream",
        buffer: GCODE_BUFFER,
      },
    },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("IN_PROGRESS");
});

test("slice file upload: rejects disallowed file extension", async ({ request }) => {
  const machine = await createTestMachine({ name: "Upload-Drucker 3" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: {
        name: "bad.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("bad file"),
      },
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("Nicht erlaubtes");
});

test("slice file upload: creates a PrintJobFile DB record", async ({ request }) => {
  const machine = await createTestMachine({ name: "Upload-Drucker 4" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: {
        name: "slice.gcode",
        mimeType: "application/octet-stream",
        buffer: GCODE_BUFFER,
      },
    },
  });
  expect(res.ok()).toBeTruthy();

  const files = await prismaTest.printJobFile.findMany({ where: { printJobId: job.id } });
  expect(files).toHaveLength(1);
  expect(files[0].originalName).toBe("slice.gcode");
});

// --- Slice file delete tests ---

test("slice file delete: removes the file record from DB", async ({ request }) => {
  const machine = await createTestMachine({ name: "Delete-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });
  const fileRecord = await createTestPrintJobFile(job.id);

  const res = await request.delete(`/api/admin/jobs/${job.id}/files/${fileRecord.id}`);
  expect(res.ok()).toBeTruthy();

  const fileInDb = await prismaTest.printJobFile.findUnique({ where: { id: fileRecord.id } });
  expect(fileInDb).toBeNull();
});

test("slice file delete: returns 404 for unknown file", async ({ request }) => {
  const machine = await createTestMachine({ name: "Delete-Drucker 404" });
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });

  const res = await request.delete(`/api/admin/jobs/${job.id}/files/nonexistent-id`);
  expect(res.status()).toBe(404);
});

// --- STL download tests ---

test("stl-download: returns a zip file (even when no parts have STL files)", async ({ request }) => {
  const machine = await createTestMachine({ name: "STL-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });

  const res = await request.get(`/api/admin/jobs/${job.id}/stl-download`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("application/zip");
  expect(res.headers()["content-disposition"]).toContain(`job-${job.id}-stl-files.zip`);
});

// --- OrcaSlicer 3MF download tests ---

test("orca-download: returns 404 when job has no parts with STL files", async ({ request }) => {
  const machine = await createTestMachine({ name: "Orca-Drucker 404" });
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });

  const res = await request.get(`/api/admin/jobs/${job.id}/orca-download`);
  expect(res.status()).toBe(404);
});

test("orca-download: returns a 3MF file when job has parts with STL files", async ({ request }) => {
  const machine = await createTestMachine({ name: "Orca-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });
  const { part } = await createTestOrderWithStlFile();
  await createTestPrintJobPart(job.id, part.id);

  const res = await request.get(`/api/admin/jobs/${job.id}/orca-download`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("model/3mf");
  expect(res.headers()["content-disposition"]).toContain(`job-${job.id}.3mf`);
});

test("orca-download: OrcaSlicer-Projekt button is visible in job detail dialog", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Orca-UI-Drucker" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("0 Teile").click();
  await expect(page.getByRole("button", { name: /OrcaSlicer-Projekt/i })).toBeVisible();
});

// --- UI tests for SLICED status ---

test("SLICED job appears in queue view", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Zeta" });
  await createTestPrintJob(machine.id, { status: "SLICED" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await expect(page.getByText("Gesliced")).toBeVisible();
});

test("SLICED job appears in timeline view", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Eta" });
  const futureTime = new Date(Date.now() + 60 * 60_000);
  await createTestPrintJob(machine.id, { status: "SLICED", plannedAt: futureTime });

  await page.goto("/admin/jobs");
  // Timeline is the default view — machine column header should be visible without switching to Queue
  await expect(page.getByText("Drucker Eta")).toBeVisible();
});

test("can change job status to SLICED in detail dialog", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Iota" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Iota/)).toBeVisible();

  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Gesliced" }).click();
  await page.getByRole("button", { name: /Änderungen speichern/i }).click();

  await expect(page.getByText("Job aktualisiert").first()).toBeVisible();
});

test("SLICED job can be deleted from detail dialog", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Kappa" });
  await createTestPrintJob(machine.id, { status: "SLICED" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Kappa/)).toBeVisible();

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Job löschen/i }).click();

  await expect(page.getByText("Job gelöscht").first()).toBeVisible();
});

test("slicing section shows upload button in job detail dialog", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Lambda" });
  await createTestPrintJob(machine.id, { status: "PLANNED" });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Drucker Lambda/)).toBeVisible();

  await expect(page.getByText("Slicing", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Slicing-Datei hochladen/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /STL-Dateien herunterladen/i })).toBeVisible();
});

// --- Timeline view switcher tests ---

test("timeline: Tag/Woche/Monat and Heute buttons are visible", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker View-Test" });
  await page.goto("/admin/jobs");

  // Timeline is the default view — no need to switch
  await expect(page.getByRole("button", { name: "Tag" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Woche" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Monat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Heute" })).toBeVisible();
});

test("timeline: navigation arrows change the date label", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Nav-Test" });
  await page.goto("/admin/jobs");

  const label = page.getByTestId("timeline-nav-label");
  // Wait for the label to be non-empty (ResizeObserver + mount completes)
  await expect(label).not.toHaveText("");
  const initialText = await label.textContent();

  await page.getByRole("button", { name: "Vor", exact: true }).click();
  const afterNextText = await label.textContent();
  expect(afterNextText).not.toBe(initialText);

  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(label).toHaveText(initialText!);
});

test("timeline: Heute button returns to current period after navigating away", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Heute-Test" });
  await page.goto("/admin/jobs");

  const label = page.getByTestId("timeline-nav-label");

  // Navigate forward two weeks
  await page.getByRole("button", { name: "Vor", exact: true }).click();
  await page.getByRole("button", { name: "Vor", exact: true }).click();
  const afterText = await label.textContent();
  // Should have moved away from today's range
  expect(afterText).toBeTruthy();

  // Click Heute — should recenter on today (today-line becomes visible)
  await page.getByRole("button", { name: "Heute" }).click();
  await expect(page.locator('[data-testid="timeline-today-line"]').first()).toBeVisible();
});

test("timeline: switching to Tag view changes the label to a single day", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Tag-Test" });
  await page.goto("/admin/jobs");

  await page.getByRole("button", { name: "Tag" }).click();
  // Day label format: "Montag, 16. März 2026" — contains a comma
  const label = page.getByTestId("timeline-nav-label");
  await expect(label).toContainText(",");
});

test("timeline: switching to Monat view shows date range label and machine name", async ({ seed, page }) => {
  await createTestMachine({ name: "Drucker Monat-Test" });
  await page.goto("/admin/jobs");

  await page.getByRole("button", { name: "Monat" }).click();

  // Month preset shows a date range, e.g. "1. – 30. April 2026"
  const label = page.getByTestId("timeline-nav-label");
  const text = await label.textContent();
  expect(text).toMatch(/\d+\. .+ \d{4}/);

  // Machine name still visible in the row
  await expect(page.getByText("Drucker Monat-Test")).toBeVisible();
});

test("timeline: planned job bar appears in week view", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Drucker Bar-Test" });
  const futureTime = new Date(Date.now() + 2 * 60 * 60_000); // 2 hours from now
  await createTestPrintJob(machine.id, { status: "PLANNED", plannedAt: futureTime });

  await page.goto("/admin/jobs");
  // Machine row should appear in timeline (default week view)
  await expect(page.getByText("Drucker Bar-Test")).toBeVisible();
});

// --- G-code print time extraction tests ---

const PRUSA_GCODE = Buffer.from(
  "; generated by PrusaSlicer\n; estimated printing time (normal mode) = 1h 23m 45s\nG28\n"
);
const CURA_GCODE = Buffer.from(";TIME:5025\n;Filament used: 1.5m\nG28\n");
const PLAIN_GCODE = Buffer.from("; no time info\nG28\nG1 X10 Y10\n");

test("gcode upload: extracts print time from PrusaSlicer G-code", async ({ request }) => {
  const machine = await createTestMachine({ name: "Gcode-Drucker 1" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "prusa.gcode", mimeType: "application/octet-stream", buffer: PRUSA_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  // 1h 23m 45s → 83m + round(45/60)=1 → 84 minutes
  expect(updated?.printTimeMinutes).toBe(84);
  expect(updated?.printTimeFromGcode).toBe(true);
});

test("gcode upload: extracts print time from Cura G-code", async ({ request }) => {
  const machine = await createTestMachine({ name: "Gcode-Drucker 2" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "cura.gcode", mimeType: "application/octet-stream", buffer: CURA_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  // 5025s → round(5025/60) = 84 minutes
  expect(updated?.printTimeMinutes).toBe(84);
  expect(updated?.printTimeFromGcode).toBe(true);
});

test("gcode upload: leaves print time unchanged when no time comment", async ({ request }) => {
  const machine = await createTestMachine({ name: "Gcode-Drucker 3" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "plain.gcode", mimeType: "application/octet-stream", buffer: PLAIN_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(updated?.printTimeMinutes).toBeNull();
  expect(updated?.printTimeFromGcode).toBe(false);
});

test("gcode delete: resets print time when last gcode file removed", async ({ request }) => {
  const machine = await createTestMachine({ name: "Gcode-Drucker 4" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  // Upload a G-code with time
  const uploadRes = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "prusa.gcode", mimeType: "application/octet-stream", buffer: PRUSA_GCODE },
    },
  });
  expect(uploadRes.ok()).toBeTruthy();
  const afterUpload = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(afterUpload?.printTimeFromGcode).toBe(true);

  // Delete the G-code file
  const fileRecord = await prismaTest.printJobFile.findFirst({ where: { printJobId: job.id } });
  const deleteRes = await request.delete(`/api/admin/jobs/${job.id}/files/${fileRecord!.id}`);
  expect(deleteRes.ok()).toBeTruthy();

  const afterDelete = await prismaTest.printJob.findUnique({ where: { id: job.id } });
  expect(afterDelete?.printTimeMinutes).toBeNull();
  expect(afterDelete?.printTimeFromGcode).toBe(false);
});

test("gcode upload: UI shows field as disabled and 'Aus G-Code extrahiert' hint", async ({ seed, page }) => {
  const machine = await createTestMachine({ name: "Gcode-UI-Drucker" });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });

  // Pre-seed: set printTimeFromGcode=true via direct DB update
  await prismaTest.printJob.update({
    where: { id: job.id },
    data: { printTimeMinutes: 84, printTimeFromGcode: true },
  });

  await page.goto("/admin/jobs");
  await page.getByRole("button", { name: /Board/i }).click();
  await page.getByText("0 Teile").click();
  await expect(page.getByText(/Druckjob — Gcode-UI-Drucker/)).toBeVisible();

  const input = page.locator("#job-print-time");
  await expect(input).toBeDisabled();
  await expect(page.getByText("Aus G-Code extrahiert")).toBeVisible();
});

// --- G-code filament extraction & inventory tests ---

// PrusaSlicer G-code with filament metadata
const PRUSA_FILAMENT_GCODE = Buffer.from(
  [
    "; generated by PrusaSlicer",
    "; estimated printing time (normal mode) = 1h 0m 0s",
    "; filament used [g] = 45.67",
    "; filament_type = PLA",
    "; filament_colour = #FF0000",
    "G28",
  ].join("\n")
);

test("gcode upload: creates PrintJobFilament record when job has matching filament", async ({ request }) => {
  const machine = await createTestMachine({ name: "Filament-Drucker 1" });
  const filament = await createTestFilament({ material: "PLA", colorHex: "#FF0000", remainingGrams: 200 });
  const phases = await prismaTest.orderPhase.findMany({ where: { isDefault: true } });
  const order = await createTestOrder(phases[0].id);
  const part = await createTestOrderPart(order.id, { filamentId: filament.id });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "filament.gcode", mimeType: "application/octet-stream", buffer: PRUSA_FILAMENT_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const usages = await prismaTest.printJobFilament.findMany({ where: { printJobId: job.id } });
  expect(usages).toHaveLength(1);
  expect(usages[0].filamentId).toBe(filament.id);
  expect(usages[0].gramsActual).toBe(46); // Math.round(45.67)
});

test("gcode upload: returns material mismatch warning when G-code material differs from job filament", async ({ request }) => {
  const machine = await createTestMachine({ name: "Filament-Drucker 2" });
  const filament = await createTestFilament({ material: "PETG", remainingGrams: 200 }); // PETG in job, PLA in G-code
  const phases = await prismaTest.orderPhase.findMany({ where: { isDefault: true } });
  const order = await createTestOrder(phases[0].id);
  const part = await createTestOrderPart(order.id, { filamentId: filament.id });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "mismatch.gcode", mimeType: "application/octet-stream", buffer: PRUSA_FILAMENT_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const { warnings } = await res.json();
  expect(warnings.some((w: string) => w.toLowerCase().includes("material"))).toBeTruthy();
});

test("gcode upload: returns insufficient filament warning when spool has too little left", async ({ request }) => {
  const machine = await createTestMachine({ name: "Filament-Drucker 3" });
  const filament = await createTestFilament({ material: "PLA", colorHex: "#FF0000", remainingGrams: 10 }); // only 10g, need 46g
  const phases = await prismaTest.orderPhase.findMany({ where: { isDefault: true } });
  const order = await createTestOrder(phases[0].id);
  const part = await createTestOrderPart(order.id, { filamentId: filament.id });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "notenough.gcode", mimeType: "application/octet-stream", buffer: PRUSA_FILAMENT_GCODE },
    },
  });
  expect(res.ok()).toBeTruthy();

  const { warnings } = await res.json();
  expect(warnings.some((w: string) => w.includes("Nicht genug"))).toBeTruthy();
});

test("gcode upload: does NOT deduct inventory immediately (deduction happens on DONE)", async ({ request }) => {
  const machine = await createTestMachine({ name: "Filament-Drucker 4" });
  const filament = await createTestFilament({ material: "PLA", colorHex: "#FF0000", remainingGrams: 200 });
  const phases = await prismaTest.orderPhase.findMany({ where: { isDefault: true } });
  const order = await createTestOrder(phases[0].id);
  const part = await createTestOrderPart(order.id, { filamentId: filament.id });
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  await request.post(`/api/admin/jobs/${job.id}/files`, {
    multipart: {
      file: { name: "nodeduct.gcode", mimeType: "application/octet-stream", buffer: PRUSA_FILAMENT_GCODE },
    },
  });

  const afterUpload = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(afterUpload?.remainingGrams).toBe(200); // unchanged
});

test("PATCH DONE: deducts grams from inventory", async ({ request }) => {
  const machine = await createTestMachine({ name: "Deduct-Drucker" });
  const filament = await createTestFilament({ material: "PLA", remainingGrams: 200 });
  const job = await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });
  await prismaTest.printJobFilament.create({
    data: { printJobId: job.id, filamentId: filament.id, gramsActual: 50 },
  });

  const res = await request.patch(`/api/admin/jobs/${job.id}`, {
    data: { status: "DONE" },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updated?.remainingGrams).toBe(150); // 200 - 50
});

test("PATCH DONE: returns low-stock warning when remaining drops below 100g", async ({ request }) => {
  const machine = await createTestMachine({ name: "LowStock-Drucker" });
  const filament = await createTestFilament({ material: "PLA", remainingGrams: 80 }); // 80 - 50 = 30g left
  const job = await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });
  await prismaTest.printJobFilament.create({
    data: { printJobId: job.id, filamentId: filament.id, gramsActual: 50 },
  });

  const res = await request.patch(`/api/admin/jobs/${job.id}`, {
    data: { status: "DONE" },
  });
  expect(res.ok()).toBeTruthy();

  const { warnings } = await res.json();
  expect(warnings.length).toBeGreaterThan(0);
  expect(warnings.some((w: string) => w.includes("30 g"))).toBeTruthy();
});

test("PATCH un-DONE: restores inventory when job is reverted from DONE", async ({ request }) => {
  const machine = await createTestMachine({ name: "Restore-Drucker" });
  const filament = await createTestFilament({ material: "PLA", remainingGrams: 150 }); // already deducted 50g
  const job = await createTestPrintJob(machine.id, { status: "DONE" });
  await prismaTest.printJobFilament.create({
    data: { printJobId: job.id, filamentId: filament.id, gramsActual: 50 },
  });

  const res = await request.patch(`/api/admin/jobs/${job.id}`, {
    data: { status: "IN_PROGRESS" },
  });
  expect(res.ok()).toBeTruthy();

  const updated = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updated?.remainingGrams).toBe(200); // 150 + 50 restored
});

test("auto-transition: deducts filament inventory when job auto-completes", async ({ request }) => {
  const machine = await createTestMachine({ name: "Auto-Filament-Drucker" });
  const filament = await createTestFilament({ material: "PLA", remainingGrams: 200 });
  const startedAt = new Date(Date.now() - 10 * 60_000);
  const job = await createTestPrintJob(machine.id, {
    status: "IN_PROGRESS",
    plannedAt: startedAt,
    startedAt,
    printTimeMinutes: 5, // 5 minutes needed, 10 elapsed → auto-completes
  });
  await prismaTest.printJobFilament.create({
    data: { printJobId: job.id, filamentId: filament.id, gramsActual: 30 },
  });

  const res = await request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).completed).toContain(job.id);

  const updated = await prismaTest.filament.findUnique({ where: { id: filament.id } });
  expect(updated?.remainingGrams).toBe(170); // 200 - 30
});
