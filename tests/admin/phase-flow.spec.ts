import { test, expect } from "../fixtures/test-base";
import { prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test.describe("Phase flow diagram + configurable gate", () => {
  test("renders all phases as nodes with chevrons", async ({ seed, page }) => {
    void seed;
    await page.goto("/admin/settings?tab=phasen");
    await expect(page.locator('[data-testid="phase-flow-diagram"]')).toBeVisible();

    // Each phase has a node
    const nodes = page.locator('[data-phase-node]');
    await expect(nodes).toHaveCount(seed.phases.length);
  });

  test("clicking a node opens the editor with Gate and Auto-Advance tabs", async ({
    seed,
    page,
  }) => {
    await page.goto("/admin/settings?tab=phasen");

    const firstNode = page.locator(`[data-phase-node="${seed.phases[0].id}"] button:has(svg)`).first();
    // The phase row has an edit button — click it to open the dialog
    await page.locator(`[data-phase-node="${seed.phases[0].id}"]`).getByRole("button").nth(1).click();
    void firstNode;

    await expect(page.getByRole("tab", { name: /Gate/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Auto-Advance/i })).toBeVisible();

    // Enable a Gate condition
    await page.locator('[data-testid="phase-tab-gate"]').click();
    const checkbox = page.locator('[data-testid="gate-3"]'); // all_jobs_done is index 3
    await checkbox.check();
    await page.locator('[data-testid="phase-save-btn"]').click();

    // Reload and assert the DB has the gate
    await page.waitForLoadState("networkidle");
    const updated = await prismaTest.orderPhase.findUnique({
      where: { id: seed.phases[0].id },
    });
    const gate = updated?.enterGate as unknown as Array<{ type: string }>;
    expect(gate).toEqual(expect.arrayContaining([expect.objectContaining({ type: "all_jobs_done" })]));
  });

  test("phase with gate displays Gate badge in the row", async ({ seed, page }) => {
    await prismaTest.orderPhase.update({
      where: { id: seed.phases[1].id },
      data: { enterGate: [{ type: "quote_approved" }] },
    });

    await page.goto("/admin/settings?tab=phasen");

    const node = page.locator(`[data-phase-node="${seed.phases[1].id}"]`);
    await expect(node).toBeVisible();
    // Phase row with gate shows an amber Gate badge with count
    await expect(node.getByText(/Gate · \d+/)).toBeVisible();
  });
});
