import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/authz";
import { publishDraft, getPublishState } from "@/lib/landing/publish";

/** Freeze the current draft as the version visitors see. */
export async function POST() {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  await publishDraft();
  return NextResponse.json({ state: await getPublishState() });
}
