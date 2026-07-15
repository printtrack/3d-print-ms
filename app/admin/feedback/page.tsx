import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FeedbackManager } from "@/components/admin/feedback/FeedbackManager";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  if (userRole !== "ADMIN") redirect("/admin");

  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  const serialized = items.map((f) => ({
    id: f.id,
    type: f.type,
    title: f.title,
    description: f.description,
    screenshotPath: f.screenshotPath,
    pageUrl: f.pageUrl,
    status: f.status,
    githubIssueUrl: f.githubIssueUrl,
    githubIssueNumber: f.githubIssueNumber,
    reporter: f.createdBy?.name ?? f.createdBy?.email ?? null,
    createdAt: f.createdAt.toISOString(),
  }));

  return <FeedbackManager initialItems={serialized} />;
}
