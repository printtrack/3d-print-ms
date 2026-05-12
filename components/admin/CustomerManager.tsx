"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Wallet, Plus, Minus, CheckCircle2, Clock, Pencil, Trash2, UserPlus, ShieldCheck } from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  creditBalance: number;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count: { orders: number };
}

interface CreditEntry {
  id: string;
  amount: number;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

function BalanceBadge({ balance }: { balance: number }) {
  const variant = balance > 100 ? "default" : balance > 0 ? "secondary" : "destructive";
  return <Badge variant={variant}>{balance} g</Badge>;
}

function VerifyBadge({ emailVerifiedAt }: { emailVerifiedAt: string | null }) {
  if (emailVerifiedAt) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Verifiziert
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" />
      Ausstehend
    </Badge>
  );
}

function CreditDialog({
  customer,
  onClose,
  onBalanceUpdated,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onBalanceUpdated: (id: string, newBalance: number) => void;
}) {
  const [history, setHistory] = useState<CreditEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState(customer.creditBalance);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/credits`);
      const data = await res.json();
      setHistory(data.credits);
      setBalance(data.creditBalance);
    } catch {
      toast.error("Fehler beim Laden");
    } finally {
      setLoadingHistory(false);
    }
  }

  function toggleHistory() {
    if (!showHistory && !history) loadHistory();
    setShowHistory((v) => !v);
  }

  async function handleSubmit() {
    const grams = parseInt(amount, 10);
    if (!grams || grams <= 0) { toast.error("Bitte eine gültige Grammzahl eingeben"); return; }
    if (!reason.trim()) { toast.error("Bitte einen Grund angeben"); return; }

    const finalAmount = mode === "deduct" ? -grams : grams;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, reason: reason.trim() }),
      });
      if (!res.ok) { toast.error((await res.json()).error ?? "Fehler"); return; }
      const credit = await res.json();
      const newBalance = balance + finalAmount;
      setBalance(newBalance);
      onBalanceUpdated(customer.id, newBalance);
      if (history !== null) setHistory((prev) => (prev ? [credit, ...prev] : [credit]));
      setAmount("");
      setReason("");
      toast.success("Guthaben gebucht");
    } catch {
      toast.error("Fehler beim Buchen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Guthaben — {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/50">
            <span className="text-sm font-medium">Aktuelles Guthaben</span>
            <BalanceBadge balance={balance} />
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={mode === "add" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("add")}>
                <Plus className="h-3.5 w-3.5 mr-1" />Aufladen
              </Button>
              <Button variant={mode === "deduct" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("deduct")}>
                <Minus className="h-3.5 w-3.5 mr-1" />Abziehen
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Menge (g) *</Label>
              <Input type="number" min="1" placeholder="z.B. 100" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Grund *</Label>
              <Input placeholder="z.B. Guthaben-Kauf, Abzug für Auftrag..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div>
            <button className="text-sm text-primary hover:underline" onClick={toggleHistory}>
              {showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
            </button>
            {showHistory && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {loadingHistory && <p className="text-sm text-muted-foreground">Laden...</p>}
                {history && history.length === 0 && <p className="text-sm text-muted-foreground">Keine Buchungen</p>}
                {history && history.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 text-sm py-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground text-xs">{formatDateTime(c.createdAt)}</span>
                      <p className="truncate text-xs">{c.reason}</p>
                    </div>
                    <span className={c.amount > 0 ? "text-green-600 font-medium shrink-0" : "text-red-600 font-medium shrink-0"}>
                      {c.amount > 0 ? "+" : ""}{c.amount} g
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Buchen..." : "Buchen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: CustomerRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.error("Bitte alle Pflichtfelder ausfüllen (Passwort min. 6 Zeichen)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Fehler"); return; }
      onCreated(data);
      toast.success("Kunde angelegt");
      onClose();
    } catch {
      toast.error("Fehler beim Anlegen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Neuen Kunden anlegen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-name">Name *</Label>
            <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">E-Mail *</Label>
            <Input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">Passwort * (min. 6 Zeichen)</Label>
            <Input id="create-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Anlegen..." : "Anlegen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  customer,
  onClose,
  onUpdated,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onUpdated: (updated: Partial<CustomerRow> & { id: string }) => void;
}) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) { toast.error("Name und E-Mail sind Pflicht"); return; }
    if (password && password.length < 6) { toast.error("Passwort muss mindestens 6 Zeichen haben"); return; }
    setSaving(true);
    try {
      const body: Record<string, string> = { name: name.trim(), email: email.trim() };
      if (password) body.password = password;
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Fehler"); return; }
      onUpdated(data);
      toast.success("Gespeichert");
      onClose();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Kunde bearbeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">E-Mail *</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-password">Neues Passwort (leer lassen = unverändert)</Label>
            <Input id="edit-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Neues Passwort..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerManager({ initialCustomers }: { initialCustomers: CustomerRow[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [activeCredit, setActiveCredit] = useState<CustomerRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  function handleBalanceUpdated(id: string, newBalance: number) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, creditBalance: newBalance } : c)));
  }

  async function handleVerify(customer: CustomerRow) {
    setVerifying(customer.id);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Fehler"); return; }
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, emailVerifiedAt: data.emailVerifiedAt } : c))
      );
      toast.success("Kunde verifiziert");
    } catch {
      toast.error("Fehler beim Verifizieren");
    } finally {
      setVerifying(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/customers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error((await res.json()).error ?? "Fehler"); return; }
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Kunde gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground text-sm">Kundenkonten und Filament-Guthaben verwalten</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Hinzufügen
        </Button>
      </div>

      <div className="grid gap-3">
        {customers.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{customer.name}</p>
                <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <VerifyBadge emailVerifiedAt={customer.emailVerifiedAt} />
                <BalanceBadge balance={customer.creditBalance} />
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {customer._count.orders} Aufträge
                </span>
                <span className="text-xs text-muted-foreground hidden md:block">
                  Seit {formatDate(customer.createdAt)}
                </span>

                {!customer.emailVerifiedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerify(customer)}
                    disabled={verifying === customer.id}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    {verifying === customer.id ? "..." : "Freischalten"}
                  </Button>
                )}

                <Button variant="outline" size="sm" onClick={() => setActiveCredit(customer)}>
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  Guthaben
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Bearbeiten" onClick={() => setEditCustomer(customer)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Löschen"
                  onClick={() => setDeleteTarget(customer)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {customers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Keine Kundenkonten</div>
      )}

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={(c) => setCustomers((prev) => [...prev, c])}
        />
      )}

      {editCustomer && (
        <EditDialog
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onUpdated={(updated) =>
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
          }
        />
      )}

      {activeCredit && (
        <CreditDialog
          customer={activeCredit}
          onClose={() => setActiveCredit(null)}
          onBalanceUpdated={handleBalanceUpdated}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird dauerhaft gelöscht. Bestehende Bestellungen bleiben erhalten, werden aber anonymisiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
