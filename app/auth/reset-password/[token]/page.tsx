import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ResetPasswordConfirmForm } from "./ResetPasswordConfirmForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordConfirmPage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations("auth");

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  const isValid = record && record.kind === "USER" && record.expires > new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("new_password_title")}</h1>
          {isValid ? (
            <p className="text-sm text-muted-foreground">
              {t("new_password_subtitle")}
            </p>
          ) : (
            <p className="text-sm text-destructive">
              {t("invalid_token")}
            </p>
          )}
        </div>
        {isValid && <ResetPasswordConfirmForm token={token} />}
      </div>
    </div>
  );
}
