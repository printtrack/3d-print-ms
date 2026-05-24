// Screenshot generator for the wiki — not part of the regular E2E suite.
// Run with: npm run wiki:screenshots
// Requires the test server to be running (playwright starts it automatically).
// Output: public/wiki-screenshots/<slug>.png

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

test.use({ storageState: "tests/.auth/admin.json" });

const WIKI_DE_DIR = path.join(process.cwd(), "docs/wiki/de/admin");
const OUTPUT_DIR = path.join(process.cwd(), "public/wiki-screenshots");

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return (yaml.load(match[1]) as Record<string, unknown>) ?? {};
}

function getPagedRoutes(): { slug: string; route: string }[] {
  const files = fs.readdirSync(WIKI_DE_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const result: { slug: string; route: string }[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(WIKI_DE_DIR, file), "utf-8");
    const data = parseFrontmatter(content);
    if (data.route) {
      result.push({ slug: file.replace(/\.md$/, ""), route: data.route as string });
    }
  }
  return result;
}

const routes = getPagedRoutes();

for (const { slug, route } of routes) {
  test(`screenshot: ${slug} (${route})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    // Settings tabs with more content need a bit longer to settle
    const waitMs = route.includes("settings") ? 1200 : 800;
    await page.waitForTimeout(waitMs);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${slug}.png`),
      fullPage: false,
    });
  });
}

// Custom screenshot: jobs page in Board (queue) view
test("screenshot: jobs-board (Board view)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/jobs");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  // Switch from Gantt to Board view
  const boardButton = page.getByRole("button", { name: "Board" });
  if (await boardButton.isVisible()) {
    await boardButton.click();
    await page.waitForTimeout(400);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "jobs-board.png"),
    fullPage: false,
  });
});
