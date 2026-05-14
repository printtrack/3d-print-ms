"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function PortalSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/portal";
  const t = useTranslations("portal");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? t("signin_failed"));
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error(t("signin_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tc("signin")}</CardTitle>
        <CardDescription>{t("signin_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("signin_email_placeholder")}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{tc("password")}</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("signing_in") : tc("signin")}
          </Button>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Link href="/portal/reset-password" className="text-primary hover:underline">
              {t("forgot_password")}
            </Link>
            <span>
              {t("no_account")}{" "}
              <Link href="/portal/register" className="text-primary hover:underline">
                {t("register_now")}
              </Link>
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
