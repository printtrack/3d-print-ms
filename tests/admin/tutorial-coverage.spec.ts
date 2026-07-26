import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Tutorial-Drift-Guard (Issue #97):
// The onboarding tutorial spotlights UI elements via `data-tutorial="..."` attributes.
// If such an attribute is renamed or removed but the tutorial logic still references it,
// the spotlight silently targets nothing — invisible until someone clicks through by hand.
//
// This static test parses every `[data-tutorial="…"]` selector the tutorial references
// (steps.ts targets + TutorialProvider/TutorialOverlay querySelectors) and asserts each
// one is actually defined somewhere in the component tree. No browser needed.
//
// Bonus: it keeps the CLAUDE.md "data-tutorial attribute inventory" table honest by
// verifying every listed attribute really lives in the component the table names.

const ROOT = process.cwd();

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

// `components/` + `app/` hold the definition sites; `lib/tutorial/` holds the
// steps.ts targetSelectors — the primary reference source Issue #97 is about.
const SOURCE_FILES = [
  ...walk(path.join(ROOT, "components"), [".tsx", ".ts"]),
  ...walk(path.join(ROOT, "app"), [".tsx", ".ts"]),
  ...walk(path.join(ROOT, "lib/tutorial"), [".tsx", ".ts"]),
];

// --- 1. Collect DEFINITION sites: JSX `data-tutorial={…}` / `data-tutorial="…"`.
//     Definition = any quoted literal inside a `data-tutorial` attribute value that is
//     NOT preceded by `[` (which would make it a CSS-selector reference instead).
//     attr -> Set<relative file path>
const definedIn = new Map<string, Set<string>>();
// --- Collect REFERENCE sites: `[data-tutorial="X"]` selector strings.  { attr, file }
const references: { attr: string; file: string }[] = [];

const defRe = /(?<!\[)\bdata-tutorial=(\{[^}]*\}|"[^"]*")/g;
const litRe = /"([^"]+)"/g;
const refRe = /\[data-tutorial="([^"]+)"\]/g;

for (const file of SOURCE_FILES) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  for (const m of src.matchAll(defRe)) {
    for (const lit of m[1].matchAll(litRe)) {
      const attr = lit[1];
      if (!definedIn.has(attr)) definedIn.set(attr, new Set());
      definedIn.get(attr)!.add(rel);
    }
  }
  for (const m of src.matchAll(refRe)) {
    references.push({ attr: m[1], file: rel });
  }
}

test("every tutorial-referenced data-tutorial selector is defined in the component tree", () => {
  const missing: string[] = [];
  for (const { attr, file } of references) {
    if (!definedIn.has(attr)) {
      missing.push(`  • "${attr}" (referenced in ${file}) — not found on any element`);
    }
  }
  expect(
    missing,
    `Tutorial spotlight targets that resolve to nothing:\n\n${missing.join("\n")}\n\n` +
      `Either restore the data-tutorial attribute or update the reference. See CLAUDE.md → Onboarding Tutorial.`
  ).toEqual([]);
});

test("CLAUDE.md data-tutorial inventory matches the code", () => {
  const claudeMd = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");

  // Extract the "### `data-tutorial` attribute inventory" section.
  const start = claudeMd.indexOf("### `data-tutorial` attribute inventory");
  expect(start, "data-tutorial inventory section not found in CLAUDE.md").toBeGreaterThan(-1);
  const rest = claudeMd.slice(start);
  const end = rest.indexOf("\n### ", 1);
  const section = end === -1 ? rest : rest.slice(0, end);

  const rowRe = /^\|\s*`([a-z0-9-]+)`\s*\|(.*)\|/gm;
  const rows: { attr: string; file: string }[] = [];
  for (const m of section.matchAll(rowRe)) {
    const fileMatch = m[2].match(/`([A-Za-z0-9]+\.tsx)`/);
    if (fileMatch) rows.push({ attr: m[1], file: fileMatch[1] });
  }
  expect(rows.length, "no inventory rows parsed from CLAUDE.md").toBeGreaterThan(0);

  const problems: string[] = [];
  for (const { attr, file } of rows) {
    const files = definedIn.get(attr);
    if (!files) {
      problems.push(`  • "${attr}" listed in CLAUDE.md but not defined anywhere in the code`);
      continue;
    }
    const hit = [...files].some((f) => path.basename(f) === file);
    if (!hit) {
      problems.push(
        `  • "${attr}" listed under ${file}, but actually defined in: ${[...files]
          .map((f) => path.basename(f))
          .join(", ")}`
      );
    }
  }
  expect(
    problems,
    `CLAUDE.md data-tutorial inventory has drifted from the code:\n\n${problems.join("\n")}`
  ).toEqual([]);
});
