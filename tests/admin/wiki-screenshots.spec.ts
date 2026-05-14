// Screenshot generator for the wiki — not part of the regular E2E suite.
// Run with: npm run wiki:screenshots
// Requires the test server to be running (playwright starts it automatically).
// Output: public/wiki-screenshots/<slug>.png

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

test.use({ storageState: "tests/.auth/admin.json" });

const WIKI_DE_DIR = path.join(process.cwd(), "docs/wiki/de/admin");
const OUTPUT_DIR = path.join(process.cwd(), "public/wiki-screenshots");

function getPagedRoutes(): { slug: string; route: string }[] {
  const files = fs.readdirSync(WIKI_DE_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const result: { slug: string; route: string }[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(WIKI_DE_DIR, file), "utf-8");
    const { data } = matter(content);
    if (data.route) {
      result.push({ slug: file.replace(/\.md$/, ""), route: data.route });
    }
  }
  return result;
}

const routes = getPagedRoutes();

for (const { slug, route } of routes) {
  test(`screenshot: ${slug} (${route})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${slug}.png`),
      fullPage: false,
    });
  });
}
