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
import { toast } from "sonner";
import { Copy, Link2, Mail, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
import { formatDate, localeToDateLocale } from "@/lib/utils";
import { INVITE_TTL_DAYS } from "@/lib/order-intake";

export interface CustomerInvite {
  token: string;
  email: string | null;
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

/** Open or expired — redeemed invites become real customers and drop out. */
export function isPendingCustomerInvite(invite: CustomerInvite): boolean {
  return !invite.usedAt;
}

export function isExpiredCustomerInvite(invite: CustomerInvite): boolean {
  return !invite.usedAt && new Date(invite.expiresAt) < new Date();
}

/**
 * A pending (or expired) customer invite rendered to match a customer card, so
 * the two read as one list. Muted + dashed to signal "not active yet".
 *
 * Admin-only UI → German labels, matching the rest of the customers page.
 */
export function PendingCustomerInviteCard({
  invite,
  onCopy,
  onRevoke,
}: {
  invite: CustomerInvite;
  onCopy: (token: string) => void;
  onRevoke: (token: string) => void;
}) {
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const expired = isExpiredCustomerInvite(invite);
  const label = invite.email ?? "Offener Link";

  return (
    <Card className="border-dashed bg-muted/30" data-testid="invite-row">
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
              ? `Abgelaufen am ${formatDate(invite.expiresAt, dateLocale)}`
              : `Gültig bis ${formatDate(invite.expiresAt, dateLocale)}`}
            {invite.note ? ` · ${invite.note}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={expired ? "destructive" : "secondary"}>
            {expired ? "Einladung abgelaufen" : "Einladung ausstehend"}
          </Badge>

          {!expired && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onCopy(invite.token)}
              aria-label={`Link kopieren: ${invite.email ?? invite.token}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRevoke(invite.token)}
            aria-label={`Einladung löschen: ${invite.email ?? invite.token}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dialog to create a customer-portal invite, opened from the "Hinzufügen" menu.
 */
export function CustomerInviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invite: CustomerInvite) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/portal/register?invite=${token}`
      );
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
      onCreated(json);
      setEmail("");
      setNote("");
      onOpenChange(false);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEmail("");
          setNote("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kunde einladen</DialogTitle>
        </DialogHeader>
        <form onSubmit={createInvite} className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Mit E-Mail-Adresse wird die Einladung direkt verschickt und gilt nur für diese Adresse.
            Ohne Adresse entsteht ein Link zum Weitergeben. Jede Einladung ist {INVITE_TTL_DAYS} Tage
            gültig und nur einmal einlösbar.
          </p>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Wird erstellt …" : "Einladen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
