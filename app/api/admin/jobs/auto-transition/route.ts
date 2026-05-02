import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runJobAutoTransition } from "@/lib/jobs-auto-transition";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runJobAutoTransition();
  return NextResponse.json(result);
}
