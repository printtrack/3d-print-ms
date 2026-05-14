import { Suspense } from "react";
import { Printer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PortalSignInForm } from "./PortalSignInForm";

export default async function PortalSignInPage() {
  const t = await getTranslations("portal");

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Printer className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t("signin_title")}</h1>
        </div>
        <Suspense>
          <PortalSignInForm />
        </Suspense>
      </div>
    </div>
  );
}
