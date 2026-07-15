import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, assertSignedIn, getActor } from "@/lib/authz";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { isBetaEnabled } from "@/lib/beta";
import { createGitHubIssue } from "@/lib/feedback-github";

const createSchema = z.object({
  type: z.enum(["BUG", "IMPROVEMENT"]),
  title: z.string().min(3).max(150),
  description: z.string().min(5).max(5000),
  pageUrl: z.string().max(2000).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  // Optional PNG screenshot as a data URL ("data:image/png;base64,....").
  screenshot: z.string().max(12_000_000).nullable().optional(),
});

// GET — list feedback for the triage view (ADMIN only).
export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json(items);
}

// POST — submit new feedback. Any authenticated team member may report, but only
// while the beta tools are enabled (Einstellungen → Beta).
export async function POST(req: NextRequest) {
  const guard = await assertSignedIn();
  if (guard) return guard;
  const actor = await getActor();

  if (!(await isBetaEnabled())) {
    return NextResponse.json({ error: "Der Beta-Modus ist deaktiviert." }, { status: 403 });
  }

  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe", issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const userId = actor?.id ?? null;

  // 1) Persist first — feedback must never be lost even if screenshot/GitHub fail.
  const feedback = await prisma.feedback.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      pageUrl: data.pageUrl ?? null,
      userAgent: data.userAgent ?? null,
      createdById: userId,
    },
  });

  // 2) Store screenshot (best-effort).
  let screenshotUrl: string | null = null;
  if (data.screenshot?.startsWith("data:image/")) {
    try {
      const base64 = data.screenshot.split(",")[1] ?? "";
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > 0 && buffer.length <= 8 * 1024 * 1024) {
        const dir = path.join(getUploadDir(), "feedback");
        await mkdir(dir, { recursive: true });
        const rel = `feedback/${feedback.id}.png`;
        await writeFile(path.join(getUploadDir(), rel), buffer);
        const screenshotPath = `/uploads/${rel}`;
        await prisma.feedback.update({ where: { id: feedback.id }, data: { screenshotPath } });
        const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
        screenshotUrl = base ? `${base}${screenshotPath}` : null;
      }
    } catch (err) {
      console.error("Feedback screenshot store failed:", err);
    }
  }

  // 3) Create GitHub issue (best-effort; no-op when GITHUB_TOKEN/REPO unset).
  const reporter = { name: actor?.name, email: actor?.email };
  const issue = await createGitHubIssue({
    type: data.type,
    title: data.title,
    description: data.description,
    pageUrl: data.pageUrl,
    userAgent: data.userAgent,
    reporter: reporter?.name ?? reporter?.email ?? null,
    screenshotUrl,
  });

  const finalFeedback = issue
    ? await prisma.feedback.update({
        where: { id: feedback.id },
        data: { githubIssueUrl: issue.url, githubIssueNumber: issue.number },
      })
    : await prisma.feedback.findUnique({ where: { id: feedback.id } });

  return NextResponse.json(finalFeedback, { status: 201 });
}
