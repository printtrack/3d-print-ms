import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { PortalResetPasswordConfirmForm } from "./PortalResetPasswordConfirmForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalResetPasswordConfirmPage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations("portal");

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  const isValid = record && record.kind === "CUSTOMER" && record.expires > new Date();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("new_password_title")}</h1>
          {isValid ? (
            <p className="text-sm text-muted-foreground">{t("new_password_subtitle")}</p>
          ) : (
            <p className="text-sm text-destructive">
              {t("invalid_token")}
            </p>
          )}
        </div>
        {isValid && <PortalResetPasswordConfirmForm token={token} />}
      </div>
    </div>
  );
}
