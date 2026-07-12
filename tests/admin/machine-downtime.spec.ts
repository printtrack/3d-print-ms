import { test, expect } from "../fixtures/test-base";
import {
  createTestMachine,
  createTestMachineDowntime,
  createTestPrintJob,
  createTestPrintReadyPart,
  createTestFilament,
  createTestUser,
  prismaTest,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// ---------------------------------------------------------------------------
// API — happy path + affected jobs
// ---------------------------------------------------------------------------

test("admin reports an outage and gets the affected jobs back", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Ausfall-Drucker" });

  // A running job + a planned job scheduled later → both affected.
  await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });
  await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: new Date(Date.now() + 6 * 3_600_000),
  });
  // A job planned in the past (before the outage start) → NOT affected.
  await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: new Date(Date.now() - 6 * 3_600_000),
  });

  const res = await page.request.post(`/api/admin/machines/${machine.id}/downtime`, {
    data: { reason: "DEFECT", note: "Extruder verstopft" },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.downtime.endedAt).toBeNull();
  expect(body.downtime.reason).toBe("DEFECT");
  // running + future-planned = 2 affected, past-planned excluded
  expect(body.affectedJobs).toHaveLength(2);
});

test("lists downtimes and resolves one via PATCH", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Wartungs-Drucker" });
  const dt = await createTestMachineDowntime(machine.id, { reason: "MAINTENANCE" });

  const listRes = await page.request.get(`/api/admin/machines/${machine.id}/downtime`);
  expect(listRes.ok()).toBeTruthy();
  const list = await listRes.json();
  expect(list.some((d: { id: string }) => d.id === dt.id)).toBeTruthy();

  const patchRes = await page.request.patch(
    `/api/admin/machines/${machine.id}/downtime/${dt.id}`,
    { data: { endedAt: new Date().toISOString() } }
  );
  expect(patchRes.ok()).toBeTruthy();
  const resolved = await prismaTest.machineDowntime.findUnique({ where: { id: dt.id } });
  expect(resolved?.endedAt).not.toBeNull();
});

test("rejects a downtime whose end is before its start", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Validierungs-Drucker" });
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const end = new Date().toISOString();
  const res = await page.request.post(`/api/admin/machines/${machine.id}/downtime`, {
    data: { reason: "MAINTENANCE", startedAt: start, endedAt: end },
  });
  expect(res.status()).toBe(400);
});

// ---------------------------------------------------------------------------
// Permission boundary
// ---------------------------------------------------------------------------

test("non-admin (TEAM_MEMBER) cannot report an outage (403)", async ({ seed, browser }) => {
  void seed;
  const machine = await createTestMachine({ name: "Geschützter Drucker" });
  await createTestUser({ email: "member-downtime@example.com", role: "TEAM_MEMBER" });

  const ctx = await browser.newContext();
  const memberPage = await ctx.newPage();
  await memberPage.goto("/auth/signin");
  await memberPage.getByLabel("E-Mail").fill("member-downtime@example.com");
  await memberPage.getByLabel("Passwort").fill("admin123");
  await memberPage.getByRole("button", { name: /Anmelden/i }).click();
  await memberPage.waitForURL("**/admin**");

  const res = await memberPage.request.post(`/api/admin/machines/${machine.id}/downtime`, {
    data: { reason: "DEFECT" },
  });
  expect(res.status()).toBe(403);
  await ctx.close();
});

test("unauthenticated outage report is blocked", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Kein-Auth-Drucker" });
  const res = await page.request.post(`/api/admin/machines/${machine.id}/downtime`, {
    data: { reason: "DEFECT" },
    headers: { cookie: "" },
  });
  expect([401, 403]).toContain(res.status());
});

// ---------------------------------------------------------------------------
// Planner + auto-transition respect downtime
// ---------------------------------------------------------------------------

test("planner skips a machine that is currently down", async ({ seed, page }) => {
  void seed;
  const filament = await createTestFilament({ material: "PLA", color: "Blau", colorHex: "#0000FF" });
  const machine = await createTestMachine({ name: "Down-Planer-Drucker" });
  await createTestMachineDowntime(machine.id, { reason: "DEFECT" }); // active now
  await createTestPrintReadyPart({ filamentId: filament.id, name: "Teil X", gramsEstimated: 50 });

  const res = await page.request.post("/api/admin/jobs/plan");
  expect(res.ok()).toBeTruthy();
  const { proposed } = await res.json();
  // Only machine is down → nothing can be proposed
  expect(proposed).toHaveLength(0);
});

test("auto-transition does not start jobs on a down machine", async ({ seed, page }) => {
  void seed;
  const downMachine = await createTestMachine({ name: "Down-Auto-Drucker" });
  const healthyMachine = await createTestMachine({ name: "Gesund-Auto-Drucker" });
  await createTestMachineDowntime(downMachine.id, { reason: "DEFECT" });

  const past = new Date(Date.now() - 60_000);
  const downJob = await createTestPrintJob(downMachine.id, { status: "PLANNED", plannedAt: past });
  const healthyJob = await createTestPrintJob(healthyMachine.id, { status: "PLANNED", plannedAt: past });

  const res = await page.request.post("/api/admin/jobs/auto-transition");
  expect(res.ok()).toBeTruthy();

  const down = await prismaTest.printJob.findUnique({ where: { id: downJob.id } });
  const healthy = await prismaTest.printJob.findUnique({ where: { id: healthyJob.id } });
  expect(down?.status).toBe("PLANNED"); // stayed put
  expect(healthy?.status).toBe("IN_PROGRESS"); // started as normal
});

// ---------------------------------------------------------------------------
// UI flow
// ---------------------------------------------------------------------------

test("reports an outage from the UI and marks the machine available again", async ({ seed, page }) => {
  void seed;
  await createTestMachine({ name: "UI-Drucker" });

  await page.goto("/admin/settings?tab=maschinen");
  const row = page.locator('[data-testid="machine-row"]').filter({ hasText: "UI-Drucker" });
  await row.waitFor();

  // Operational at first
  await expect(row.locator('[data-testid="machine-status-dot"]')).toHaveAttribute("data-status", "operational");

  await row.getByTestId("machine-report-outage").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Als ausgefallen markieren/i }).click();

  await expect(page.getByText("Ausfall erfasst").first()).toBeVisible();
  await expect(row.locator('[data-testid="machine-status-dot"]')).toHaveAttribute("data-status", "down");

  // Mark available again
  await row.getByTestId("machine-mark-available").click();
  await expect(page.getByText("Maschine wieder verfügbar").first()).toBeVisible();
  await expect(row.locator('[data-testid="machine-status-dot"]')).toHaveAttribute("data-status", "operational");
});

test("outage assistant opens for affected jobs and reschedules them to the backlog", async ({ seed, page }) => {
  void seed;
  const machine = await createTestMachine({ name: "Assistent-UI-Drucker" });
  await createTestPrintJob(machine.id, { status: "IN_PROGRESS" });
  const plannedJob = await createTestPrintJob(machine.id, {
    status: "PLANNED",
    plannedAt: new Date(Date.now() + 6 * 3_600_000),
  });

  await page.goto("/admin/settings?tab=maschinen");
  const row = page.locator('[data-testid="machine-row"]').filter({ hasText: "Assistent-UI-Drucker" });
  await row.waitFor();
  await row.getByTestId("machine-report-outage").click();
  await page.getByRole("dialog").getByRole("button", { name: /Als ausgefallen markieren/i }).click();

  // Assistant step appears with both affected jobs, default choice = backlog
  await expect(page.getByText("Betroffene Jobs umplanen")).toBeVisible();
  await expect(page.locator('[data-testid="reschedule-job-row"]')).toHaveCount(2);

  await page.getByRole("button", { name: /Umplanung anwenden/i }).click();

  // Dialog closes and the planned job is back in the backlog (plannedAt cleared)
  await expect(page.getByText("Jobs umgeplant").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const refreshed = await prismaTest.printJob.findUnique({ where: { id: plannedJob.id } });
  expect(refreshed?.plannedAt).toBeNull();
});
