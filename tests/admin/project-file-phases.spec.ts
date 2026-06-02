import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestUser, createTestProjectFilePhase } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Projekt-Dateiphasen API", () => {
  test("admin can create, edit and delete a file phase", async ({ seed, page }) => {
    // Create
    const createRes = await page.request.post("/api/admin/project-file-phases", {
      data: { name: "Freigegeben", color: "#10b981" },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe("Freigegeben");

    // List
    const listRes = await page.request.get("/api/admin/project-file-phases");
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.some((p: { id: string }) => p.id === created.id)).toBeTruthy();

    // Edit
    const patchRes = await page.request.patch(
      `/api/admin/project-file-phases/${created.id}`,
      { data: { name: "Abgenommen" } }
    );
    expect(patchRes.ok()).toBeTruthy();
    expect((await patchRes.json()).name).toBe("Abgenommen");

    // Delete
    const delRes = await page.request.delete(`/api/admin/project-file-phases/${created.id}`);
    expect(delRes.ok()).toBeTruthy();
    const gone = await prismaTest.projectFilePhase.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });

  test("setting a phase as default unsets the previous default", async ({ seed, page }) => {
    const prevDefault = seed.projectFilePhases.find((p) => p.isDefault)!;
    const other = seed.projectFilePhases.find((p) => !p.isDefault)!;

    const res = await page.request.patch(`/api/admin/project-file-phases/${other.id}`, {
      data: { isDefault: true },
    });
    expect(res.ok()).toBeTruthy();

    const refreshedPrev = await prismaTest.projectFilePhase.findUnique({ where: { id: prevDefault.id } });
    expect(refreshedPrev?.isDefault).toBe(false);
  });

  test("non-admin (TEAM_MEMBER) cannot create a file phase (403)", async ({ seed, browser }) => {
    await createTestUser({ email: "member-phases@example.com", role: "TEAM_MEMBER" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/auth/signin");
    await page.getByLabel("E-Mail").fill("member-phases@example.com");
    await page.getByLabel("Passwort").fill("admin123");
    await page.getByRole("button", { name: /Anmelden/i }).click();
    await page.waitForURL("**/admin**");

    const res = await page.request.post("/api/admin/project-file-phases", {
      data: { name: "Verboten", color: "#ef4444" },
    });
    expect(res.status()).toBe(403);

    await ctx.close();
  });

  test("unauthenticated request is blocked", async ({ seed, page }) => {
    void seed;
    const res = await page.request.post("/api/admin/project-file-phases", {
      data: { name: "NoAuth", color: "#ef4444" },
      headers: { cookie: "" }, // clear auth cookie
    });
    expect([401, 403]).toContain(res.status());
  });

  test("phase row appears in settings tab", async ({ seed, page }) => {
    await createTestProjectFilePhase({ name: "Sichtbare Phase" });
    await page.goto("/admin/settings?tab=projektdateiphasen");
    await expect(page.getByRole("heading", { name: "Projekt-Dateiphasen" })).toBeVisible();
    await expect(page.getByText("Sichtbare Phase")).toBeVisible();
  });
});
