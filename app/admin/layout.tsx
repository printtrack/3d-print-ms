import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { TutorialProvider } from "@/components/admin/tutorial/TutorialProvider";
import { Toaster } from "@/components/ui/sonner";
import { getEnabledFeatures } from "@/lib/features";
import { getBranding } from "@/lib/branding";
import { prisma } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as { role?: string })?.role;
  const [branding, user, enabledFeatures] = await Promise.all([
    getBranding(),
    prisma.user.findUnique({
      where: { id: session.user?.id ?? "" },
      select: { onboardedAt: true },
    }),
    getEnabledFeatures(),
  ]);

  const shouldAutoStart = user?.onboardedAt === null || user?.onboardedAt === undefined;

  return (
    <TutorialProvider autoStart={shouldAutoStart}>
      <div className="flex h-screen bg-background">
        <AdminNav userRole={userRole} companyName={branding.companyName} logoUrl={branding.logoUrl} enabledFeatures={enabledFeatures} />
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
          <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</div>
        </main>
        <Toaster />
      </div>
    </TutorialProvider>
  );
}
