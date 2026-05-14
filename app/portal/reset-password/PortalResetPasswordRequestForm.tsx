"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function PortalResetPasswordRequestForm() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/portal/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error(tc("unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm">
          {t("reset_sent", { email })}
        </p>
        <Link href="/portal/signin" className="text-sm text-primary hover:underline">
          {t("back_to_signin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{tc("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("reset_email_placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tc("sending") : t("reset_link_cta")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/portal/signin" className="text-primary hover:underline">
          {t("back_to_signin")}
        </Link>
      </p>
    </form>
  );
}
