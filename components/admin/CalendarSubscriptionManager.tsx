"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarRange, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
}

interface FormState {
  name: string;
  url: string;
  color: string;
  isActive: boolean;
}

const DEFAULT_FORM: FormState = { name: "", url: "", color: "#0ea5e9", isActive: true };

export function CalendarSubscriptionManager({ initialSubscriptions }: { initialSubscriptions: CalendarSubscription[] }) {
  const t = useTranslations("admin");
  const [subs, setSubs] = useState<CalendarSubscription[]>(initialSubscriptions);
  const [editing, setEditing] = useState<CalendarSubscription | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/calendar-subscriptions")
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh) => fresh && setSubs(fresh))
      .catch(() => {});
  }, []);

  function openCreate() {
    setForm(DEFAULT_FORM);
    setEditing(null);
    setOpen(true);
  }

  function openEdit(sub: CalendarSubscription) {
    setForm({ name: sub.name, url: sub.url, color: sub.color, isActive: sub.isActive });
    setEditing(sub);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error(t("calsub_save_failed"));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), url: form.url.trim(), color: form.color, isActive: form.isActive };
      const res = editing
        ? await fetch(`/api/admin/calendar-subscriptions/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/calendar-subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("calsub_save_failed"));
      }
      const saved: CalendarSubscription = await res.json();
      setSubs((prev) => (editing ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]));
      toast.success(t("calsub_saved"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("calsub_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sub: CalendarSubscription) {
    if (!confirm(t("calsub_confirm_delete"))) return;
    try {
      const res = await fetch(`/api/admin/calendar-subscriptions/${sub.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
      toast.success(t("calsub_deleted"));
    } catch {
      toast.error(t("calsub_save_failed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("calsub_title")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("calsub_desc")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("calsub_add")}
        </Button>
      </div>

      <div className="space-y-2">
        {subs.map((sub) => (
          <div key={sub.id} className="flex items-center gap-3 rounded-lg border bg-card p-3" data-testid="calsub-row">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: sub.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{sub.name}</span>
                {!sub.isActive && <Badge variant="secondary" className="text-xs">{t("calsub_active")}: —</Badge>}
                {sub.lastError && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" /> {t("calsub_error")}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{sub.url}</p>
              <p className="text-xs text-muted-foreground">
                {t("calsub_last_sync")}: {sub.lastFetchedAt ? new Date(sub.lastFetchedAt).toLocaleString() : t("calsub_never")}
                {sub.lastError ? ` · ${sub.lastError}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sub)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(sub)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {subs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <CalendarRange className="h-8 w-8 opacity-40" />
          {t("calsub_empty")}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("calsub_edit") : t("calsub_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="calsub-name">{t("calsub_name")}</Label>
              <Input id="calsub-name" value={form.name} placeholder={t("calsub_name_ph")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calsub-url">{t("calsub_url")}</Label>
              <Input id="calsub-url" value={form.url} placeholder={t("calsub_url_ph")} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label htmlFor="calsub-color">{t("calsub_color")}</Label>
                <input
                  id="calsub-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border bg-card"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
                <Label>{t("calsub_active")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("calsub_cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? `${t("calsub_save")}…` : t("calsub_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
