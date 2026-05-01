import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plan } from "@/lib/job-planner";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await plan();
  return NextResponse.json(result);
}
