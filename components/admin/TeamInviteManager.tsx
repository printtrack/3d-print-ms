"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";
import { Copy, Link2, Mail, Trash2, Shield, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, localeToDateLocale } from "@/lib/utils";
import { INVITE_TTL_DAYS } from "@/lib/order-intake";
import type { TeamRoleOption } from "@/components/admin/TeamManager";

export interface TeamInvite {
  token: string;
  email: string | null;
  note: string | null;
  role: "ADMIN" | "TEAM_MEMBER";
  teamRoleId: string | null;
  restrictedToAssigned: boolean | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

/** Open or expired — redeemed invites become real members and drop out of the list. */
export function isPendingInvite(invite: TeamInvite): boolean {
  return !invite.usedAt;
}

export function isExpiredInvite(invite: TeamInvite): boolean {
  return !invite.usedAt && new Date(invite.expiresAt) < new Date();
}

/** null = inherit from the role, true/false = override baked into the invite. */
type RestrictionChoice = "inherit" | "yes" | "no";

function fromChoice(c: RestrictionChoice): boolean | null {
  return c === "inherit" ? null : c === "yes";
}

/**
 * A pending (or expired) team invite rendered to match a member card, so the two
 * read as one list. Muted + dashed to signal "not active yet".
 */
export function PendingTeamInviteCard({
  invite,
  roleName,
  onCopy,
  onRevoke,
}: {
  invite: TeamInvite;
  roleName: string | null;
  onCopy: (token: string) => void;
  onRevoke: (token: string) => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const expired = isExpiredInvite(invite);
  const label = invite.email ?? t("team_invite_open_link");

  return (
    <Card className="border-dashed bg-muted/30" data-testid="team-invite-row">
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-muted text-muted-foreground">
            {invite.email ? <Mail className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{label}</p>
          <p className="text-sm text-muted-foreground truncate">
            {expired
              ? t("team_invite_expired_on", { date: formatDate(invite.expiresAt, dateLocale) })
              : t("team_invite_valid_until", { date: formatDate(invite.expiresAt, dateLocale) })}
            {invite.note ? ` · ${invite.note}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            {invite.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {invite.role === "ADMIN" ? t("team_role_admin") : (roleName ?? t("team_role_member"))}
          </Badge>

          <Badge variant={expired ? "destructive" : "secondary"}>
            {expired ? t("team_invite_expired") : t("team_invite_pending")}
          </Badge>

          {!expired && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onCopy(invite.token)}
              aria-label={t("team_invite_copy_aria", { name: invite.email ?? invite.token })}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRevoke(invite.token)}
            aria-label={t("team_invite_delete_aria", { name: invite.email ?? invite.token })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dialog to create a team invite, opened from the "Hinzufügen" menu. The admin
 * fixes role + permissions here; the redeemer only sets name + password.
 */
export function TeamInviteDialog({
  roles,
  open,
  onOpenChange,
  onCreated,
}: {
  roles: TeamRoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invite: TeamInvite) => void;
}) {
  const t = useTranslations("admin");
  const defaultRoleId = roles.find((r) => r.isDefault)?.id ?? roles[0]?.id ?? "";

  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState<"ADMIN" | "TEAM_MEMBER">("TEAM_MEMBER");
  const [teamRoleId, setTeamRoleId] = useState(defaultRoleId);
  const [restriction, setRestriction] = useState<RestrictionChoice>("inherit");

  function resetForm() {
    setEmail("");
    setNote("");
    setRole("TEAM_MEMBER");
    setTeamRoleId(defaultRoleId);
    setRestriction("inherit");
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/auth/accept-invite?token=${token}`
      );
      toast.success(t("team_invite_copied"));
    } catch {
      toast.error(t("team_invite_copy_failed"));
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || null,
          note: note.trim() || null,
          role,
          teamRoleId: role === "ADMIN" ? null : teamRoleId,
          restrictedToAssigned: role === "ADMIN" ? null : fromChoice(restriction),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? t("team_invite_create_failed"));
        return;
      }
      onCreated(json);
      resetForm();
      onOpenChange(false);
      if (json.email) {
        toast.success(t("team_invite_sent", { email: json.email }));
      } else {
        await copyLink(json.token);
      }
    } catch {
      toast.error(t("team_invite_create_failed"));
    } finally {
      setCreating(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === teamRoleId);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team_invite_dialog_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={createInvite} className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t("team_invite_desc", { days: INVITE_TTL_DAYS })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="team_invite_email">{t("team_invite_email_label")}</Label>
            <Input
              id="team_invite_email"
              type="email"
              placeholder="kollege@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team_invite_note">{t("team_invite_note_label")}</Label>
            <Input
              id="team_invite_note"
              type="text"
              placeholder={t("team_invite_note_placeholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("team_role_label")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "TEAM_MEMBER")}>
              <SelectTrigger data-testid="team-invite-systemrole-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEAM_MEMBER">{t("team_role_option")}</SelectItem>
                <SelectItem value="ADMIN">{t("team_role_admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "TEAM_MEMBER" && (
            <>
              <div className="space-y-2">
                <Label>{t("team_teamrole_label")}</Label>
                <Select value={teamRoleId} onValueChange={setTeamRoleId}>
                  <SelectTrigger data-testid="team-invite-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("team_restricted_label")}</Label>
                <Select value={restriction} onValueChange={(v) => setRestriction(v as RestrictionChoice)}>
                  <SelectTrigger data-testid="team-invite-restriction-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      {t("team_restricted_inherit")}
                      {selectedRole
                        ? ` (${selectedRole.restricted ? t("team_restricted_yes") : t("team_restricted_no")})`
                        : ""}
                    </SelectItem>
                    <SelectItem value="yes">{t("team_restricted_yes")}</SelectItem>
                    <SelectItem value="no">{t("team_restricted_no")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("team_invite_cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t("team_invite_creating") : t("team_invite_cta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
