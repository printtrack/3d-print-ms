import { Suspense } from "react";
import { ResetPasswordRequestForm } from "./ResetPasswordRequestForm";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Passwort zurücksetzen</h1>
          <p className="text-sm text-muted-foreground">
            Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.
          </p>
        </div>
        <Suspense>
          <ResetPasswordRequestForm />
        </Suspense>
      </div>
    </div>
  );
}
