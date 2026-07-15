"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Lock, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
  type PermissionGroup,
} from "@/lib/permissions";
import type { FeatureKey } from "@/lib/features";

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  isDefault: boolean;
  restricted: boolean;
  permissions: { key: string }[];
  _count: { users: number };
}

interface FormState {
  name: string;
  description: string;
  restricted: boolean;
  permissions: Set<PermissionKey>;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  restricted: false,
  permissions: new Set(DEFAULT_ROLE_PERMISSIONS),
};

export function RoleManager({
  initialRoles,
  enabledFeatures,
}: {
  initialRoles: RoleListItem[];
  enabledFeatures: Record<FeatureKey, boolean>;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<RoleListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Rights for a switched-off module would be dead weight in the matrix.
  const visible = PERMISSIONS.filter((p) => !p.feature || enabledFeatures[p.feature] !== false);
  const groups = PERMISSION_GROUPS.filter((g) => visible.some((p) => p.group === g));

  function openCreate() {
    setForm({ ...EMPTY, permissions: new Set(DEFAULT_ROLE_PERMISSIONS) });
    setIsCreating(true);
  }

  function openEdit(role: RoleListItem) {
    setForm({
      name: role.name,
      description: role.description ?? "",
      restricted: role.restricted,
      permissions: new Set(role.permissions.map((p) => p.key) as PermissionKey[]),
    });
    setEditing(role);
  }

  function toggle(key: PermissionKey, on: boolean) {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (on) next.add(key);
      else next.delete(key);
      return { ...f, permissions: next };
    });
  }

  function toggleGroup(group: PermissionGroup, on: boolean) {
    setForm((f) => {
      const next = new Set(f.permissions);
      for (const p of visible.filter((x) => x.group === group)) {
        if (on) next.add(p.key);
        else next.delete(p.key);
      }
      return { ...f, permissions: next };
    });
  }

  function close() {
    setEditing(null);
    setIsCreating(false);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t("roles_name_label"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        restricted: form.restricted,
        permissions: [...form.permissions],
      };
      const res = await fetch(
        editing ? `/api/admin/roles/${editing.id}` : "/api/admin/roles",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        toast.error((await res.json()).error ?? tc("error"));
        return;
      }
      const saved: RoleListItem = await res.json();
      setRoles((prev) =>
        editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved],
      );
      toast.success(editing ? t("roles_saved") : t("roles_created"));
      close();
    } catch {
      toast.error(tc("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: RoleListItem) {
    if (!confirm(t("roles_delete_confirm", { name: role.name }))) return;
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error((await res.json()).error ?? tc("error"));
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success(t("roles_deleted"));
    } catch {
      toast.error(tc("error"));
    }
  }

  const open = isCreating || !!editing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("roles_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("roles_desc")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("roles_add")}
        </Button>
      </div>

      <div className="grid gap-3">
        {roles.map((role) => (
          <Card key={role.id} data-testid="role-row">
            <CardContent className="flex items-center gap-4 p-4">
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${role.color}1a`, color: role.color }}
              >
                <ShieldCheck className="h-4 w-4" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{role.name}</p>
                  {role.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      {t("roles_system_badge")}
                    </Badge>
                  )}
                  {role.restricted && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      {t("team_restricted_badge")}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {role.description ?? t("roles_members", { count: role._count.users })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {t("roles_members", { count: role._count.users })}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(role)}
                  aria-label={t("roles_dialog_edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(role)}
                  disabled={role.isSystem}
                  aria-label={tc("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {roles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">{t("roles_empty")}</div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("roles_dialog_edit") : t("roles_dialog_new")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">{t("roles_name_label")} *</Label>
              <Input
                id="role-name"
                value={form.name}
                placeholder={t("roles_name_placeholder")}
                disabled={editing?.isSystem}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {editing?.isSystem && (
                <p className="text-xs text-muted-foreground">{t("roles_system_hint")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">{t("roles_description_label")}</Label>
              <Input
                id="role-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="role-restricted" className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  {t("roles_restricted_label")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("roles_restricted_hint")}</p>
              </div>
              <Switch
                id="role-restricted"
                checked={form.restricted}
                onCheckedChange={(v) => setForm((f) => ({ ...f, restricted: v }))}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("roles_permissions_title")}</h3>

              {groups.map((group) => {
                const perms = visible.filter((p) => p.group === group);
                const allOn = perms.every((p) => form.permissions.has(p.key));
                const scoped = perms.some((p) => p.scoped);

                return (
                  <div key={group} className="rounded-lg border p-3 space-y-3" data-testid={`perm-group-${group}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t(`perm_group_${group}`)}</p>
                        <p className="text-xs text-muted-foreground">
                          {scoped ? t("roles_scoped_hint") : t("roles_global_hint")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => toggleGroup(group, !allOn)}
                      >
                        {allOn ? tc("none") : tc("all")}
                      </Button>
                    </div>

                    <div className="grid gap-2.5">
                      {perms.map((p) => (
                        <label
                          key={p.key}
                          htmlFor={`perm-${p.key}`}
                          className="flex items-start gap-2.5 cursor-pointer"
                        >
                          <Checkbox
                            id={`perm-${p.key}`}
                            checked={form.permissions.has(p.key)}
                            onCheckedChange={(v) => toggle(p.key, v === true)}
                            className="mt-0.5"
                          />
                          <span className="space-y-0.5">
                            <span
                              className={`text-sm block ${p.dangerous ? "text-destructive font-medium" : ""}`}
                            >
                              {t(`perm_${p.key.replace(/\./g, "_")}_label`)}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              {t(`perm_${p.key.replace(/\./g, "_")}_desc`)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
