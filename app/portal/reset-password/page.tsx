import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PortalResetPasswordRequestForm } from "./PortalResetPasswordRequestForm";

export default async function PortalResetPasswordPage() {
  const t = await getTranslations("portal");

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("reset_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("reset_subtitle")}
          </p>
        </div>
        <Suspense>
          <PortalResetPasswordRequestForm />
        </Suspense>
      </div>
    </div>
  );
}
