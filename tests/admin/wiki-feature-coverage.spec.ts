import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Sibling of wiki-coverage.spec.ts. That test only guarantees that every
// SIDEBAR ROUTE has a wiki file. This one goes further: it verifies that
// important FEATURES — which often live *inside* a route (e.g. the whole
// quote/invoice billing flow inside the order detail) — are actually
// explained somewhere in the wiki, in BOTH languages.
//
// Add a new entry here whenever you ship a feature that a user needs to
// understand. If the keyword for a feature can't be found, the wiki is
// missing documentation and this test fails the pre-push hook.
//
// See CLAUDE.md → "Admin-Wiki": every feature must be documented, not just
// sidebar routes.

type FeatureCheck = {
  feature: string;
  // At least ONE keyword from each language list must appear in that
  // language's combined wiki text (case-insensitive).
  de: string[];
  en: string[];
};

const FEATURE_CHECKS: FeatureCheck[] = [
  { feature: "Quotes", de: ["Angebot erstellen"], en: ["Create a quote", "Create quote"] },
  { feature: "Quote sending / approval", de: ["Freigabe durch den Kunden"], en: ["Customer approval"] },
  { feature: "Quote versions", de: ["Neue Version"], en: ["New version"] },
  { feature: "Invoices", de: ["Rechnung ausstellen", "Rechnung erstellen"], en: ["issue an invoice", "Create an invoice"] },
  { feature: "Invoice issue / diff", de: ["Prüfen & ausstellen", "Diff-Ansicht", "Vergleichs-Dialog"], en: ["Review & issue", "diff view", "comparison dialog"] },
  { feature: "Payments", de: ["Zahlung erfassen"], en: ["Record a payment", "Record payment"] },
  { feature: "Partial payments", de: ["Teilzahlung"], en: ["Partial payment"] },
  { feature: "Customer credit", de: ["Kundenguthaben", "Guthaben"], en: ["Customer credit", "credit balance"] },
  { feature: "Dunning / reminders", de: ["Mahnung"], en: ["dunning", "reminder"] },
  { feature: "Storno / cancellation", de: ["Storno"], en: ["Cancellation", "cancellation invoice"] },
  { feature: "Billing PDFs", de: ["Rechnungs-PDF", "Angebots-PDF"], en: ["invoice PDF", "quote PDF"] },
  { feature: "Billing settings — bank details", de: ["Bankverbindung", "IBAN"], en: ["Bank details", "IBAN"] },
  { feature: "Billing settings — small business", de: ["Kleinunternehmer"], en: ["Small-business", "small business"] },
  { feature: "Billing settings — number ranges", de: ["Nummernkreis", "Rechnungs-Präfix"], en: ["Number range", "Invoice prefix"] },
  { feature: "Customer portal", de: ["Kundenportal"], en: ["Customer portal", "customer portal"] },
  { feature: "Customer verification modes", de: ["Verifizierungs-Modi", "Verifikation neu registrierter Kunden"], en: ["Verification modes", "verification mode"] },
  { feature: "Project sprint roadmap", de: ["Sprint-Roadmap", "Roadmap mit Sprints"], en: ["sprint roadmap", "roadmap of sprints"] },
  { feature: "Project files", de: ["Projektdateien"], en: ["project files"] },
  { feature: "Project file phases", de: ["Dateiphasen"], en: ["file phases"] },
  { feature: "Project internal comments", de: ["rein interne"], en: ["purely internal"] },
  { feature: "Tracking timeline visibility", de: ["Kundenverlauf"], en: ["Customer timeline", "tracking timeline"] },
  { feature: "Feature modules", de: ["Funktionsumfang"], en: ["feature scope"] },
  { feature: "Branding", de: ["Akzentfarbe", "eigenes Logo"], en: ["accent color", "own logo"] },
  { feature: "Order form config", de: ["Auftragsformular anpassen"], en: ["configure the order form"] },
];

function readWikiText(locale: "de" | "en"): string {
  const dir = path.join(process.cwd(), "docs/wiki", locale, "admin");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => fs.readFileSync(path.join(dir, f), "utf-8"))
    .join("\n")
    .toLowerCase();
}

test("every key feature is documented in the wiki (DE and EN)", () => {
  const deText = readWikiText("de");
  const enText = readWikiText("en");
  const missing: string[] = [];

  for (const check of FEATURE_CHECKS) {
    const deHit = check.de.some((kw) => deText.includes(kw.toLowerCase()));
    const enHit = check.en.some((kw) => enText.includes(kw.toLowerCase()));
    if (!deHit) missing.push(`DE: "${check.feature}" (expected one of: ${check.de.join(", ")})`);
    if (!enHit) missing.push(`EN: "${check.feature}" (expected one of: ${check.en.join(", ")})`);
  }

  expect(
    missing,
    `Wiki is missing documentation for these features — add a page/section:\n\n${missing
      .map((m) => `  • ${m}`)
      .join("\n")}\n\nSee CLAUDE.md → Admin-Wiki.`
  ).toEqual([]);
});
