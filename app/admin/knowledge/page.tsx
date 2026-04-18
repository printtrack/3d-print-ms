import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { KnowledgeManager } from "@/components/admin/KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as { role?: string })?.role;

  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, name: true } }, files: true },
  });

  const serialized = entries.map((e) => ({
    ...e,
    tags: (e.tags as string[]) ?? [],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    files: e.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
  }));

  return <KnowledgeManager initialEntries={serialized} userRole={userRole} />;
}
