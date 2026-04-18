"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2, Pencil, Shield, User } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEAM_MEMBER";
  createdAt: string;
  _count: { assignedOrders: number };
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function TeamManager({
  initialMembers,
  currentUserId,
}: {
  initialMembers: TeamMember[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "TEAM_MEMBER" as "ADMIN" | "TEAM_MEMBER",
  });

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "TEAM_MEMBER" as "ADMIN" | "TEAM_MEMBER", password: "" });
  const [editLoading, setEditLoading] = useState(false);

  function openEdit(member: TeamMember) {
    setEditingMember(member);
    setEditForm({ name: member.name, email: member.email, role: member.role, password: "" });
  }

  async function handleEdit() {
    if (!editingMember) return;
    setEditLoading(true);
    try {
      const body: Record<string, string> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;

      const res = await fetch(`/api/admin/team/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }

      const updated = await res.json();
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? { ...m, name: updated.name, email: updated.email, role: updated.role }
            : m
        )
      );
      setEditingMember(null);
      toast.success("Änderungen gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setEditLoading(false);
    }
  }

  function openCreate() {
    setForm({ name: "", email: "", password: "", role: "TEAM_MEMBER" });
    setIsCreating(true);
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) {
      toast.error("Alle Felder ausfüllen");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }

      const newMember = await res.json();
      setMembers((prev) => [...prev, { ...newMember, _count: { assignedOrders: 0 } }]);
      setIsCreating(false);
      toast.success("Teammitglied hinzugefügt");
    } catch {
      toast.error("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: TeamMember) {
    if (member.id === currentUserId) {
      toast.error("Du kannst dich nicht selbst löschen");
      return;
    }
    if (!confirm(`"${member.name}" wirklich entfernen?`)) return;

    try {
      const res = await fetch(`/api/admin/team/${member.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Teammitglied entfernt");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm">
            Verwalte die Teammitglieder und ihre Rollen
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </div>

      <div className="grid gap-3">
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{member.name}</p>
                  {member.id === currentUserId && (
                    <Badge variant="outline" className="text-xs">Du</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{member.email}</p>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant={member.role === "ADMIN" ? "default" : "secondary"}
                  className="gap-1"
                >
                  {member.role === "ADMIN" ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {member.role === "ADMIN" ? "Admin" : "Mitglied"}
                </Badge>

                <span className="text-xs text-muted-foreground hidden sm:block">
                  {member._count.assignedOrders} Aufträge
                </span>

                <span className="text-xs text-muted-foreground hidden sm:block">
                  Seit {formatDate(member.createdAt)}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(member)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(member)}
                  disabled={member.id === currentUserId}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Keine Teammitglieder</div>
      )}

      <Dialog open={!!editingMember} onOpenChange={(open) => { if (!open) setEditingMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitglied bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Max Mustermann"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <Input
                type="email"
                placeholder="max@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((p) => ({ ...p, role: v as "ADMIN" | "TEAM_MEMBER" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEAM_MEMBER">Team-Mitglied</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                placeholder="Leer lassen = unverändert"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading ? "Speichern..." : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Teammitglied</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Max Mustermann"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <Input
                type="email"
                placeholder="max@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Passwort *</Label>
              <Input
                type="password"
                placeholder="Mindestens 6 Zeichen"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((p) => ({ ...p, role: v as "ADMIN" | "TEAM_MEMBER" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEAM_MEMBER">Team-Mitglied</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Erstellen..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
