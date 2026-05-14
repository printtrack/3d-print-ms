import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { ADMIN_NAV_HREFS, hrefToSlug } from "../../components/admin/admin-nav-items";

// This test verifies that every sidebar route has a corresponding wiki page
// in both DE and EN. It fails the pre-push hook if any wiki page is missing.
// Run as part of the regular E2E suite via: npm run test:e2e

test("every sidebar route has a wiki page in DE and EN", () => {
  const wikiDir = path.join(process.cwd(), "docs/wiki");
  const missing: string[] = [];

  for (const href of ADMIN_NAV_HREFS) {
    const slug = hrefToSlug(href);
    const deFile = path.join(wikiDir, "de", "admin", `${slug}.md`);
    const enFile = path.join(wikiDir, "en", "admin", `${slug}.md`);

    if (!fs.existsSync(deFile)) {
      missing.push(`docs/wiki/de/admin/${slug}.md (route: ${href})`);
    }
    if (!fs.existsSync(enFile)) {
      missing.push(`docs/wiki/en/admin/${slug}.md (route: ${href})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing wiki pages — add them before pushing:\n\n${missing.map((m) => `  • ${m}`).join("\n")}\n\nSee CLAUDE.md → Admin-Wiki section.`
    );
  }
});
