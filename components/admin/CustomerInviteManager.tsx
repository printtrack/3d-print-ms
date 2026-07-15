"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Link2, Mail, Plus, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
import { formatDate, localeToDateLocale } from "@/lib/utils";
import { INVITE_TTL_DAYS } from "@/lib/order-intake";

interface Invite {
  token: string;
  email: string | null;
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

type InviteState = "used" | "expired" | "open";

function inviteState(invite: Invite): InviteState {
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt) < new Date()) return "expired";
  return "open";
}

const STATE_LABEL: Record<InviteState, string> = {
  used: "Eingelöst",
  expired: "Abgelaufen",
  open: "Offen",
};

// Admin-only UI → German labels, matching the rest of the settings form.
export function CustomerInviteManager() {
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      if (!res.ok) throw new Error();
      setInvites(await res.json());
    } catch {
      toast.error("Einladungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function inviteUrl(token: string) {
    return `${window.location.origin}/portal/register?invite=${token}`;
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast.success("Link kopiert");
    } catch {
      toast.error("Link konnte nicht kopiert werden");
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null, note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Einladung konnte nicht erstellt werden");
        return;
      }
      setInvites((prev) => [json, ...prev]);
      setEmail("");
      setNote("");
      if (json.email) {
        toast.success(`Einladung an ${json.email} verschickt`);
      } else {
        await copyLink(json.token);
      }
    } catch {
      toast.error("Einladung konnte nicht erstellt werden");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token: string) {
    if (!confirm("Einladung wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/admin/invites/${token}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setInvites((prev) => prev.filter((i) => i.token !== token));
      toast.success("Einladung gelöscht");
    } catch {
      toast.error("Einladung konnte nicht gelöscht werden");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Einladungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Mit E-Mail-Adresse wird die Einladung direkt verschickt und gilt nur für diese Adresse.
          Ohne Adresse entsteht ein Link zum Weitergeben. Jede Einladung ist {INVITE_TTL_DAYS} Tage
          gültig und nur einmal einlösbar.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={createInvite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="invite_email">E-Mail (optional)</Label>
            <Input
              id="invite_email"
              type="email"
              placeholder="kunde@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite_note">Notiz (optional)</Label>
            <Input
              id="invite_note"
              type="text"
              placeholder="z. B. Messekontakt"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Wird erstellt …" : "Einladen"}
          </Button>
        </form>

        {loading ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : invites.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Noch keine Einladungen erstellt.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {invites.map((invite) => {
              const state = inviteState(invite);
              return (
                <li
                  key={invite.token}
                  data-testid="invite-row"
                  className="flex flex-wrap items-center gap-3 p-3 text-sm"
                >
                  {invite.email ? (
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invite.email ?? "Offener Link"}</p>
                    <p className="text-xs text-muted-foreground">
                      {state === "used"
                        ? `Eingelöst am ${formatDate(invite.usedAt!, dateLocale)}`
                        : `Gültig bis ${formatDate(invite.expiresAt, dateLocale)}`}
                      {invite.note ? ` · ${invite.note}` : ""}
                    </p>
                  </div>
                  <Badge variant={state === "open" ? "default" : "secondary"}>
                    {STATE_LABEL[state]}
                  </Badge>
                  {state === "open" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(invite.token)}
                      aria-label={`Link kopieren: ${invite.email ?? invite.token}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(invite.token)}
                    aria-label={`Einladung löschen: ${invite.email ?? invite.token}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
