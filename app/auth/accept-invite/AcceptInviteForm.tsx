"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function AcceptInviteForm({
  token,
  inviteEmail,
}: {
  token: string;
  /** Set for address-bound invites: the account must use this address. */
  inviteEmail?: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: inviteEmail ?? "",
    password: "",
    confirm: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error(tc("password_mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/team-invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          password: form.password,
          ...(inviteEmail ? {} : { email: form.email }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? t("accept_invite_failed"));
        return;
      }
      toast.success(t("accept_invite_success"));
      router.push(`/auth/signin?email=${encodeURIComponent(json.email)}`);
    } catch {
      toast.error(t("accept_invite_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accept_invite_title")}</CardTitle>
        <CardDescription>{t("accept_invite_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input
              id="name"
              type="text"
              placeholder="Max Mustermann"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="max@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              autoComplete="email"
              readOnly={Boolean(inviteEmail)}
              className={inviteEmail ? "bg-muted" : undefined}
            />
            {inviteEmail && (
              <p className="text-xs text-muted-foreground">{t("accept_invite_email_locked")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{tc("password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={tc("min_6_chars")}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{tc("password_confirm")}</Label>
            <Input
              id="confirm"
              type="password"
              placeholder={tc("password_repeat")}
              value={form.confirm}
              onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("accept_invite_creating") : t("accept_invite_cta")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
