import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestProject, createTestOrder, createTestMilestone } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Projekte", () => {
  test("nav link navigates to projects page", async ({ seed, page }) => {
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: "Projekte" }).click();
    await expect(page).toHaveURL("/admin/projects");
    await expect(page.getByRole("heading", { name: "Projekte" })).toBeVisible();
  });

  test("shows empty columns when no projects exist", async ({ seed, page }) => {
    await page.goto("/admin/projects");
    await expect(page.getByText("Planung").first()).toBeVisible();
    await expect(page.getByText("Noch keine Projekte").first()).toBeVisible();
  });

  test("shows existing projects in kanban column", async ({ seed, page }) => {
    await createTestProject({ name: "Messestand CES 2026" });
    await page.goto("/admin/projects");
    await expect(page.getByText("Messestand CES 2026").first()).toBeVisible();
    await expect(page.getByText("Planung").first()).toBeVisible();
  });

  test("creates a new project via dialog", async ({ seed, page }) => {
    await page.goto("/admin/projects");
    await page.getByRole("button", { name: "+ Neues Projekt" }).click();

    await page.getByLabel("Name *").fill("Showroom Redesign");
    await page.getByLabel("Beschreibung").fill("Neues Design für den Showroom");

    await page.getByRole("button", { name: "Erstellen" }).click();

    await expect(page.getByText("Showroom Redesign").first()).toBeVisible({ timeout: 5000 });
  });

  test("opens project detail page", async ({ seed, page }) => {
    const project = await createTestProject({
      name: "Produkt Launch Q3",
      description: "Launch-Vorbereitung für Q3",
    });

    await page.goto(`/admin/projects/${project.id}`);
    await expect(page.getByText("Produkt Launch Q3", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Launch-Vorbereitung für Q3")).toBeVisible();
    await expect(page.getByRole("main").getByText("Planung").first()).toBeVisible();
  });

  test("changes project phase via header chip", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Phase Test Projekt" });
    const aktiv = seed.projectPhases.find((p) => p.name === "Aktiv")!;

    await page.goto(`/admin/projects/${project.id}`);

    await page.getByTestId("project-phase-chip").click();
    await page.getByRole("button", { name: "Aktiv" }).click();

    await expect(async () => {
      const updated = await prismaTest.project.findUnique({ where: { id: project.id } });
      expect(updated?.projectPhaseId).toBe(aktiv.id);
    }).toPass({ timeout: 5000 });
  });

  test("links an order to a project", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Link Test Projekt" });
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();
    await createTestOrder(phase!.id, { customerName: "Max Mustermann" });

    await page.goto(`/admin/projects/${project.id}`);

    await page.getByRole("main").getByRole("button", { name: "Verknüpfen" }).click();

    await expect(page.getByPlaceholder("Aufträge suchen...")).toBeVisible();

    const orderRow = page.getByText("Max Mustermann").locator("..").locator("..");
    await orderRow.getByRole("button", { name: "Verknüpfen" }).click();

    await expect(page.getByText("Auftrag verknüpft").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Max Mustermann").first()).toBeVisible();
  });

  test("shows project milestones in the roadmap", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Milestone Test Projekt" });
    // Orphan milestone (no sprint) — the detail page migrates it into a default sprint
    await createTestMilestone(project.id, { useProjectId: true, name: "Konzept fertig" });

    await page.goto(`/admin/projects/${project.id}`);

    await expect(page.getByText("Konzept fertig")).toBeVisible({ timeout: 5000 });
  });

  test("deletes a project and returns to list", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Zu löschendes Projekt" });

    await page.goto(`/admin/projects/${project.id}`);

    await page.locator('[data-slot="alert-dialog-trigger"]').click();

    await page.getByRole("button", { name: "Löschen" }).click();

    await expect(page).toHaveURL("/admin/projects", { timeout: 5000 });
    await expect(page.getByText("Zu löschendes Projekt")).not.toBeVisible();
  });

  test("shows project badge on kanban card when order is linked", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Kanban Badge Test" });
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();
    await createTestOrder(phase!.id, {
      customerName: "Badge Kunde",
      projectId: project.id,
    });

    await page.goto("/admin/orders");
    await expect(page.getByText("Kanban Badge Test").first()).toBeVisible();
  });

  test("toggle to Gantt view shows project bar", async ({ seed, page }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    await createTestProject({ name: "Gantt Test Projekt", deadline: futureDate });

    await page.goto("/admin/projects");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    await expect(page.getByText("Gantt-Ansicht").first()).toBeVisible();
    await expect(page.getByText("Gantt Test Projekt").first()).toBeVisible();
  });

  test("Gantt shows linked orders under project", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Projekt mit Aufträgen" });
    const phase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
    if (!phase) test.skip();
    await createTestOrder(phase!.id, {
      customerName: "Verknüpfter Auftrag",
      projectId: project.id,
    });

    await page.goto("/admin/projects");
    await page.getByRole("button", { name: "Gantt", exact: true }).click();

    await expect(page.getByText("Projekt mit Aufträgen").first()).toBeVisible();
    await expect(page.getByText("Verknüpfter Auftrag").first()).toBeVisible();
  });

  test("project appears in kanban column after phase change", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Aktives Projekt" });

    const aktivPhase = await prismaTest.projectPhase.findFirst({ where: { name: "Aktiv" } });
    if (!aktivPhase) test.skip();
    await prismaTest.project.update({
      where: { id: project.id },
      data: { projectPhaseId: aktivPhase!.id },
    });

    await page.goto("/admin/projects");
    await expect(page.getByText("Aktives Projekt")).toBeVisible();
    await expect(page.getByText("Aktiv").first()).toBeVisible();
  });
});
