"use client";

import { useState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CustomerVerificationBanner({
  mode,
}: {
  mode: "admin" | "email";
}) {
  const [sending, setSending] = useState(false);

  async function handleResend() {
    setSending(true);
    try {
      const res = await fetch("/api/portal/auth/resend-verification", { method: "POST" });
      if (res.ok) {
        toast.success("Bestätigungsmail wurde erneut gesendet");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Senden");
      }
    } catch {
      toast.error("Fehler beim Senden");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {mode === "admin" ? (
          <p className="text-sm text-amber-800">
            <span className="font-medium">Konto noch nicht freigeschaltet.</span> Das Team prüft Ihre Registrierung. Sobald Ihr Konto freigeschalten wurde, können Sie Bestellungen aufgeben.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-amber-800">
              <span className="font-medium">E-Mail-Adresse noch nicht bestätigt.</span> Bitte prüfen Sie Ihr Postfach und klicken Sie den Bestätigungs-Link.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
              onClick={handleResend}
              disabled={sending}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {sending ? "Senden..." : "Erneut senden"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
