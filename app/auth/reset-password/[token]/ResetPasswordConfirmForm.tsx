"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ResetPasswordConfirmForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(tc("password_mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc("error"));
      toast.success(t("password_changed"));
      router.push("/auth/signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("new_password_title")}</Label>
        <Input
          id="password"
          type="password"
          placeholder={tc("min_6_chars")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tc("saving") : t("save_password")}
      </Button>
    </form>
  );
}
