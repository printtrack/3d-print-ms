// DB access for the landing page blocks (server only).
//
// Follows the split lib/order-form-config.ts established: the pure, testable,
// client-importable parts live in ./blocks and ./defaults, this file is the thin
// async wrapper around prisma.

import { prisma } from "@/lib/db";
import { parseBlock } from "./blocks";

// The rows in this table are the DRAFT — what the editor works on. Visitors see
// the published snapshot instead (lib/landing/publish.ts); the two only meet
// when an admin clicks "Publish".

/**
 * What the editor lists: every block including hidden ones, plus a flag for rows
 * the registry can no longer parse — the editor shows those as broken instead of
 * silently hiding them, which is how an admin finds out at all.
 */
export interface EditorBlock {
  id: string;
  type: string;
  position: number;
  visible: boolean;
  data: unknown;
  valid: boolean;
}

export async function getEditorLandingBlocks(): Promise<EditorBlock[]> {
  const rows = await prisma.landingBlock.findMany({ orderBy: { position: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    position: row.position,
    visible: row.visible,
    data: row.data,
    valid: parseBlock(row) !== null,
  }));
}

export async function countLandingBlocks(): Promise<number> {
  return prisma.landingBlock.count();
}
