import { Suspense } from "react";
import { PortalResetPasswordRequestForm } from "./PortalResetPasswordRequestForm";

export default function PortalResetPasswordPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Passwort zurücksetzen</h1>
          <p className="text-sm text-muted-foreground">
            Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.
          </p>
        </div>
        <Suspense>
          <PortalResetPasswordRequestForm />
        </Suspense>
      </div>
    </div>
  );
}
