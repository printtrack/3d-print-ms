// Draft vs. published.
//
// The LandingBlock rows are the DRAFT: what the editor mutates, live, block by
// block. Visitors never see it. What they see is the PUBLISHED snapshot — a
// frozen copy taken the last time an admin clicked "Publish", stored as one JSON
// document in a Setting row. Until the first publish, visitors get the built-in
// defaults, exactly as before this feature existed.
//
//   draft (rows) ──publish──▶ published (snapshot) ──render──▶ visitors
//         ▲                          │
//         └─────────discard──────────┘
//
// Storing the snapshot in Setting (@db.Text) rather than a new table avoids a
// migration — painful in this repo — and reuses an established pattern
// (survey_questions is a JSON blob in a Setting row too).

import { prisma } from "@/lib/db";
import { parseBlock, type LandingBlock } from "./blocks";
import { buildDefaultBlocks } from "./defaults";

export const PUBLISHED_KEY = "landing_published_blocks";

interface SnapshotBlock {
  type: string;
  visible: boolean;
  data: unknown;
}

/**
 * Deterministic JSON. MySQL reorders JSON object keys on its own, and JS keeps
 * insertion order, so the same content read from a row and from the stored
 * snapshot can serialize differently. Sorting keys recursively makes the
 * comparison about content, not key order — otherwise the page would always
 * look "unpublished".
 */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stable((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function stableString(blocks: SnapshotBlock[]): string {
  return JSON.stringify(stable(blocks));
}

function safeParse(raw: string): SnapshotBlock[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function draftSnapshot(): Promise<SnapshotBlock[]> {
  const rows = await prisma.landingBlock.findMany({ orderBy: { position: "asc" } });
  return rows.map((r) => ({ type: r.type, visible: r.visible, data: r.data }));
}

async function readPublishedRaw(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: PUBLISHED_KEY } });
  return row?.value?.trim() ? row.value : null;
}

/**
 * What visitors see: the published snapshot's visible blocks in order, or the
 * built-in defaults if the page was never published. A snapshot block whose
 * data no longer parses is dropped — one bad block must not 500 the front page.
 */
export async function getPublishedLandingBlocks(): Promise<LandingBlock[]> {
  const raw = await readPublishedRaw();
  if (!raw) return buildDefaultBlocks();
  return safeParse(raw)
    .map((b, i) =>
      parseBlock({ id: `pub-${i}`, type: b.type, position: i, visible: b.visible, data: b.data }),
    )
    .filter((b): b is LandingBlock => b !== null && b.visible);
}

export type PublishState = "pristine" | "unpublished" | "published";

/**
 * - `pristine`   — no draft, never published: visitors get the defaults.
 * - `unpublished`— the draft differs from what is public (or was never published).
 * - `published`  — the draft and the public page are the same.
 */
export async function getPublishState(): Promise<PublishState> {
  const [rows, raw] = await Promise.all([draftSnapshot(), readPublishedRaw()]);
  if (rows.length === 0 && !raw) return "pristine";
  const published = stableString(raw ? safeParse(raw) : []);
  return stableString(rows) === published ? "published" : "unpublished";
}

export async function publishDraft(): Promise<void> {
  const snapshot = await draftSnapshot();
  const value = JSON.stringify(snapshot);
  await prisma.setting.upsert({
    where: { key: PUBLISHED_KEY },
    update: { value },
    create: { key: PUBLISHED_KEY, value },
  });
}

/**
 * Reset the draft to the published version: drop every row and rebuild from the
 * snapshot. With nothing published yet this empties the draft — back to pristine,
 * which is the correct "published state" then.
 */
export async function discardDraft(): Promise<void> {
  const raw = await readPublishedRaw();
  const published = raw ? safeParse(raw) : [];
  await prisma.$transaction([
    prisma.landingBlock.deleteMany({}),
    ...published.map((b, i) =>
      prisma.landingBlock.create({
        data: { type: b.type, position: i, visible: b.visible, data: b.data as object },
      }),
    ),
  ]);
}
