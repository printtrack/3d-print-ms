import { prisma } from "@/lib/db";
import { PortalResetPasswordConfirmForm } from "./PortalResetPasswordConfirmForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalResetPasswordConfirmPage({ params }: PageProps) {
  const { token } = await params;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  const isValid = record && record.expires > new Date();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Neues Passwort</h1>
          {isValid ? (
            <p className="text-sm text-muted-foreground">Geben Sie Ihr neues Passwort ein.</p>
          ) : (
            <p className="text-sm text-destructive">
              Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.
            </p>
          )}
        </div>
        {isValid && <PortalResetPasswordConfirmForm token={token} />}
      </div>
    </div>
  );
}
