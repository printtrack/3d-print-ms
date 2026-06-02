import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestProject,
  createTestProjectFile,
  createTestProjectComment,
  createTestMilestone,
  createTestUser,
  makeStlBuffer,
} from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

const ADMIN_ID = "test-admin-user-fixed-id";

test.describe("Projekt-Detail: Dateien", () => {
  test("uploads a file and assigns the default file phase", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Messestand Dateien" });

    const res = await page.request.post(`/api/admin/projects/${project.id}/files`, {
      multipart: {
        files: {
          name: "entwurf.stl",
          mimeType: "model/stl",
          buffer: makeStlBuffer(10, 10, 10),
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.files).toHaveLength(1);

    // Default phase ("Entwurf") was assigned
    const defaultPhase = seed.projectFilePhases.find((p) => p.isDefault);
    expect(body.files[0].phase?.id).toBe(defaultPhase?.id);

    const stored = await prismaTest.projectFile.findMany({ where: { projectId: project.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].originalName).toBe("entwurf.stl");
  });

  test("rejects a disallowed file extension", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Messestand Reject" });

    const res = await page.request.post(`/api/admin/projects/${project.id}/files`, {
      multipart: {
        files: {
          name: "schad.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("MZ malicious"),
        },
      },
    });
    expect(res.status()).toBe(400);

    const stored = await prismaTest.projectFile.findMany({ where: { projectId: project.id } });
    expect(stored).toHaveLength(0);
  });

  test("changes a file's phase", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Phasenwechsel" });
    const file = await createTestProjectFile(project.id);
    const finalPhase = seed.projectFilePhases.find((p) => p.name === "Final")!;

    const res = await page.request.patch(
      `/api/admin/projects/${project.id}/files/${file.id}`,
      { data: { phaseId: finalPhase.id } }
    );
    expect(res.ok()).toBeTruthy();

    const updated = await prismaTest.projectFile.findUnique({ where: { id: file.id } });
    expect(updated?.phaseId).toBe(finalPhase.id);
  });

  test("deletes a file", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Datei löschen" });
    const file = await createTestProjectFile(project.id);

    const res = await page.request.delete(
      `/api/admin/projects/${project.id}/files/${file.id}`
    );
    expect(res.ok()).toBeTruthy();

    const stored = await prismaTest.projectFile.findUnique({ where: { id: file.id } });
    expect(stored).toBeNull();
  });
});

test.describe("Projekt-Detail: Kommentare", () => {
  test("adds an internal comment", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Kommentar Projekt" });

    const res = await page.request.post(`/api/admin/projects/${project.id}/comments`, {
      data: { content: "Interner Hinweis zum Messestand" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("Interner Hinweis zum Messestand");
    expect(body.author.id).toBe(ADMIN_ID);

    const stored = await prismaTest.projectComment.findMany({ where: { projectId: project.id } });
    expect(stored).toHaveLength(1);
  });

  test("rejects an empty comment", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Leerer Kommentar" });

    const res = await page.request.post(`/api/admin/projects/${project.id}/comments`, {
      data: { content: "" },
    });
    expect(res.status()).toBe(400);

    const stored = await prismaTest.projectComment.findMany({ where: { projectId: project.id } });
    expect(stored).toHaveLength(0);
  });
});

test.describe("Projekt-Detail: Sprint-Roadmap", () => {
  test("completing all tasks marks the milestone complete and reverts on uncheck", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Sync Test" });
    const milestone = await createTestMilestone(project.id, { useProjectId: true, name: "M1" });

    // Add a task to the milestone
    const taskRes = await page.request.post(`/api/admin/milestones/${milestone.id}/tasks`, {
      data: { title: "Aufgabe 1" },
    });
    expect(taskRes.status()).toBe(201);
    const task = await taskRes.json();

    // Completing the only task should mark the milestone complete (persisted server-side)
    const patchRes = await page.request.patch(
      `/api/admin/milestones/${milestone.id}/tasks/${task.id}`,
      { data: { completed: true } }
    );
    expect(patchRes.ok()).toBeTruthy();
    const doneMs = await prismaTest.milestone.findUnique({ where: { id: milestone.id } });
    expect(doneMs?.completedAt).not.toBeNull();

    // Unchecking the task should reset the milestone
    await page.request.patch(`/api/admin/milestones/${milestone.id}/tasks/${task.id}`, {
      data: { completed: false },
    });
    const openMs = await prismaTest.milestone.findUnique({ where: { id: milestone.id } });
    expect(openMs?.completedAt).toBeNull();
  });

  test("creates a sprint and milestone on project level", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Roadmap Projekt" });

    const sprintRes = await page.request.post(`/api/admin/sprints`, {
      data: { projectId: project.id, name: "Phase 1" },
    });
    expect(sprintRes.status()).toBe(201);
    const sprint = await sprintRes.json();
    expect(sprint.projectId).toBe(project.id);

    const msRes = await page.request.post(`/api/admin/milestones`, {
      data: { projectId: project.id, sprintId: sprint.id, name: "Aufbau fertig" },
    });
    expect(msRes.status()).toBe(201);
    const milestone = await msRes.json();
    expect(milestone.projectId).toBe(project.id);
    expect(milestone.sprintId).toBe(sprint.id);
  });
});

test.describe("Projekt-Detail: UI", () => {
  test("renders files, comments and the sticky header phase chip", async ({ seed, page }) => {
    const project = await createTestProject({ name: "UI Projekt" });
    await createTestProjectFile(project.id, { originalName: "plan.stl" });
    await createTestProjectComment(project.id, ADMIN_ID, { content: "Erster Kommentar" });

    await page.goto(`/admin/projects/${project.id}`);

    // Sticky header chip
    await expect(page.getByTestId("project-phase-chip")).toBeVisible();
    // Files section + uploaded file
    await expect(page.getByTestId("project-files")).toBeVisible();
    await expect(page.getByText("plan.stl")).toBeVisible();
    // Comments section + existing comment
    await expect(page.getByTestId("project-comments")).toBeVisible();
    await expect(page.getByText("Erster Kommentar")).toBeVisible();
  });

  test("changes the project phase via the header chip", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Phasenwechsel UI" });
    const target = seed.projectPhases.find((p) => !p.isDefault)!;

    await page.goto(`/admin/projects/${project.id}`);
    await page.getByTestId("project-phase-chip").click();
    await page.getByRole("button", { name: target.name }).click();

    await expect(async () => {
      const updated = await prismaTest.project.findUnique({ where: { id: project.id } });
      expect(updated?.projectPhaseId).toBe(target.id);
    }).toPass({ timeout: 5000 });
  });

  test("adds a comment through the UI", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Kommentar UI" });

    await page.goto(`/admin/projects/${project.id}`);
    await page.getByTestId("project-comment-input").fill("UI Kommentar Test");
    await page.getByRole("button", { name: "Kommentar hinzufügen" }).click();

    await expect(page.getByText("UI Kommentar Test")).toBeVisible({ timeout: 5000 });
  });

  test("edits the deadline via the header chip", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Deadline Header" });

    await page.goto(`/admin/projects/${project.id}`);
    await page.getByTestId("deadline-chip").click();
    await page.getByRole("button", { name: "In 1 Woche" }).click();

    await expect(async () => {
      const updated = await prismaTest.project.findUnique({ where: { id: project.id } });
      expect(updated?.deadline).not.toBeNull();
    }).toPass({ timeout: 5000 });
  });

  test("assigns a team member via the header stack", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Assignee Header" });
    const member = await createTestUser({ name: "Erika Beispiel", email: "erika@example.com" });

    await page.goto(`/admin/projects/${project.id}`);
    await page.getByTestId("assignee-stack").click();
    await page.getByRole("button", { name: /Erika Beispiel/ }).click();

    await expect(async () => {
      const assignees = await prismaTest.projectAssignee.findMany({ where: { projectId: project.id } });
      expect(assignees.map((a) => a.userId)).toContain(member.id);
    }).toPass({ timeout: 5000 });
  });

  test("history tab shows audit entries", async ({ seed, page }) => {
    const project = await createTestProject({ name: "Verlauf Projekt" });
    await prismaTest.projectAuditLog.create({
      data: {
        projectId: project.id,
        userId: seed.admin.id,
        action: "FILE_UPLOADED",
        details: "1 Datei(en) hochgeladen",
      },
    });

    await page.goto(`/admin/projects/${project.id}`);
    // Switch to the "Verlauf" (history) tab
    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText("Datei hochgeladen")).toBeVisible();
    await expect(page.getByText("1 Datei(en) hochgeladen")).toBeVisible();
  });
});
