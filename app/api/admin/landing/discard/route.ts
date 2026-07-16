import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/authz";
import { discardDraft, getPublishState } from "@/lib/landing/publish";

/** Throw away draft changes, restoring the last published version. */
export async function POST() {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  await discardDraft();
  return NextResponse.json({ state: await getPublishState() });
}
