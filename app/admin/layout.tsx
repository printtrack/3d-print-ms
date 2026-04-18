import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { Toaster } from "@/components/ui/sonner";
import { getSetting } from "@/lib/settings";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as { role?: string })?.role;
  const companyName = (await getSetting("company_name")) ?? "3D Print CMS";

  return (
    <div className="flex h-screen bg-background">
      <AdminNav userRole={userRole} companyName={companyName} />
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
