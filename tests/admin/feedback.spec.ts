import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestUser } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// The Setting table is NOT truncated by resetDb(), so the beta toggle would leak
// between tests. beta_mode defaults to ON (no row). Any test that flips it off
// restores it afterwards.
async function setBeta(value: "true" | "false") {
  await prismaTest.setting.upsert({
    where: { key: "beta_mode" },
    update: { value },
    create: { key: "beta_mode", value },
  });
}

test.afterEach(async () => {
  await setBeta("true");
});

// ─── API ────────────────────────────────────────────────────────────────────

test("admin can submit feedback and it appears in the triage list", async ({ seed, page }) => {
  void seed;
  const create = await page.request.post("/api/admin/feedback", {
    data: {
      type: "BUG",
      title: "Kanban lädt nicht",
      description: "Beim Öffnen des Boards bleibt die Seite leer.",
      pageUrl: "http://localhost:3001/admin",
    },
  });
  expect(create.status()).toBe(201);
  const created = await create.json();
  expect(created.status).toBe("NEW");
  expect(created.githubIssueUrl).toBeFalsy(); // no GITHUB_TOKEN in tests

  const list = await page.request.get("/api/admin/feedback");
  expect(list.ok()).toBeTruthy();
  const items = await list.json();
  expect(items.some((i: { title: string }) => i.title === "Kanban lädt nicht")).toBeTruthy();
});

test("invalid feedback (title too short) is rejected with 400", async ({ seed, page }) => {
  void seed;
  const res = await page.request.post("/api/admin/feedback", {
    data: { type: "BUG", title: "x", description: "y" },
  });
  expect(res.status()).toBe(400);
});

test("feedback status transition NEW → IN_PROGRESS is persisted", async ({ seed, page }) => {
  void seed;
  const feedback = await prismaTest.feedback.create({
    data: { type: "IMPROVEMENT", title: "Dark-Mode wäre schön", description: "Bitte einen dunklen Modus." },
  });

  const patch = await page.request.patch(`/api/admin/feedback/${feedback.id}`, {
    data: { status: "IN_PROGRESS" },
  });
  expect(patch.ok()).toBeTruthy();

  const reloaded = await prismaTest.feedback.findUnique({ where: { id: feedback.id } });
  expect(reloaded?.status).toBe("IN_PROGRESS");
});

test("admin can delete feedback", async ({ seed, page }) => {
  void seed;
  const feedback = await prismaTest.feedback.create({
    data: { type: "BUG", title: "Tippfehler", description: "Auf der Startseite." },
  });
  const del = await page.request.delete(`/api/admin/feedback/${feedback.id}`);
  expect(del.ok()).toBeTruthy();
  const gone = await prismaTest.feedback.findUnique({ where: { id: feedback.id } });
  expect(gone).toBeNull();
});

test("submitting feedback is blocked when beta mode is off (403)", async ({ seed, page }) => {
  void seed;
  await setBeta("false");
  const res = await page.request.post("/api/admin/feedback", {
    data: { type: "BUG", title: "Sollte scheitern", description: "Weil Beta aus ist." },
  });
  expect(res.status()).toBe(403);
});

// ─── Permission boundaries ───────────────────────────────────────────────────

test("TEAM_MEMBER cannot list or triage feedback (403)", async ({ seed, browser }) => {
  void seed;
  await createTestUser({ email: "member-feedback@example.com", role: "TEAM_MEMBER" });
  const feedback = await prismaTest.feedback.create({
    data: { type: "BUG", title: "Nur für Admins", description: "Triage-Test." },
  });

  const ctx = await browser.newContext();
  const memberPage = await ctx.newPage();
  await memberPage.goto("/auth/signin");
  await memberPage.getByLabel("E-Mail").fill("member-feedback@example.com");
  await memberPage.getByLabel("Passwort").fill("admin123");
  await memberPage.getByRole("button", { name: /Anmelden/i }).click();
  await memberPage.waitForURL("**/admin**");

  const list = await memberPage.request.get("/api/admin/feedback");
  expect(list.status()).toBe(403);

  const patch = await memberPage.request.patch(`/api/admin/feedback/${feedback.id}`, {
    data: { status: "RESOLVED" },
  });
  expect(patch.status()).toBe(403);

  await ctx.close();
});

test("unauthenticated feedback submission is blocked", async ({ seed, page }) => {
  void seed;
  const res = await page.request.post("/api/admin/feedback", {
    data: { type: "BUG", title: "Kein Login", description: "Sollte 401 sein." },
    headers: { cookie: "" },
  });
  expect([401, 403]).toContain(res.status());
});

// ─── UI ──────────────────────────────────────────────────────────────────────

test("feedback widget lets a team member report a bug end-to-end", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin");
  await page.getByTestId("feedback-button").click();
  const dialog = page.getByTestId("feedback-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByTestId("feedback-type-IMPROVEMENT").click();
  await page.getByLabel("Titel").fill("Filter für Aufträge");
  await page.getByLabel("Beschreibung").fill("Ich hätte gern einen Statusfilter in der Auftragsliste.");
  await page.getByTestId("feedback-submit").click();

  await expect(page.getByText(/Danke/i).first()).toBeVisible();

  // The report shows up in the admin triage view.
  await page.goto("/admin/feedback");
  await expect(page.getByText("Filter für Aufträge")).toBeVisible();
});

test("feedback widget captures and attaches a page screenshot", async ({ seed, page }) => {
  void seed;
  await page.goto("/admin/feedback");
  await page.getByTestId("feedback-button").click();
  await page.getByLabel("Titel").fill("Screenshot-Test");
  await page.getByLabel("Beschreibung").fill("Meldung mit angehängtem Screenshot.");

  // Capture the current page (html2canvas-pro, no permission prompt). The dialog
  // hides itself, snapshots, then reopens showing the editable canvas.
  await page.getByRole("button", { name: /Aktuelle Seite aufnehmen/i }).click();
  await expect(page.getByTestId("feedback-canvas")).toBeVisible({ timeout: 20000 });

  await page.getByTestId("feedback-submit").click();
  await expect(page.getByText(/Danke/i).first()).toBeVisible();

  const row = await prismaTest.feedback.findFirst({ where: { title: "Screenshot-Test" } });
  expect(row?.screenshotPath).toMatch(/^\/uploads\/feedback\/.+\.png$/);
});

test("feedback widget is hidden when beta mode is off", async ({ seed, page }) => {
  void seed;
  await setBeta("false");
  await page.goto("/admin");
  await expect(page.getByTestId("feedback-button")).toHaveCount(0);
});
