import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { commitPlan } from "@/lib/job-auto-plan";

const jobEntrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("new"), machineId: z.string().min(1), partIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("extend"), existingJobId: z.string().min(1), partIds: z.array(z.string().min(1)).min(1) }),
]);

const commitSchema = z.object({
  jobs: z.array(jobEntrySchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const body = await req.json();
    const { jobs } = commitSchema.parse(body);

    const created = await commitPlan(jobs, userId);

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
