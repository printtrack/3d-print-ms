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
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Wallet, Plus, Minus } from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  creditBalance: number;
  createdAt: string;
}

interface CreditEntry {
  id: string;
  amount: number;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

function BalanceBadge({ balance }: { balance: number }) {
  const variant =
    balance > 100
      ? "default"
      : balance > 0
      ? "secondary"
      : "destructive";
  const label = `${balance} g`;
  return <Badge variant={variant}>{label}</Badge>;
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
    if (!showHistory && !history) {
      loadHistory();
    }
    setShowHistory((v) => !v);
  }

  async function handleSubmit() {
    const grams = parseInt(amount, 10);
    if (!grams || grams <= 0) {
      toast.error("Bitte eine gültige Grammzahl eingeben");
      return;
    }
    if (!reason.trim()) {
      toast.error("Bitte einen Grund angeben");
      return;
    }

    const finalAmount = mode === "deduct" ? -grams : grams;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, reason: reason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }

      const credit = await res.json();
      const newBalance = balance + finalAmount;
      setBalance(newBalance);
      onBalanceUpdated(customer.id, newBalance);

      if (history !== null) {
        setHistory((prev) => (prev ? [credit, ...prev] : [credit]));
      }

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
              <Button
                variant={mode === "add" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("add")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Aufladen
              </Button>
              <Button
                variant={mode === "deduct" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("deduct")}
              >
                <Minus className="h-3.5 w-3.5 mr-1" />
                Abziehen
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Menge (g) *</Label>
              <Input
                type="number"
                min="1"
                placeholder="z.B. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Grund *</Label>
              <Input
                placeholder="z.B. Guthaben-Kauf, Abzug für Auftrag..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <button
              className="text-sm text-primary hover:underline"
              onClick={toggleHistory}
            >
              {showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {loadingHistory && (
                  <p className="text-sm text-muted-foreground">Laden...</p>
                )}
                {history && history.length === 0 && (
                  <p className="text-sm text-muted-foreground">Keine Buchungen</p>
                )}
                {history &&
                  history.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-2 text-sm py-1"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(c.createdAt)}
                        </span>
                        <p className="truncate text-xs">{c.reason}</p>
                      </div>
                      <span
                        className={
                          c.amount > 0
                            ? "text-green-600 font-medium shrink-0"
                            : "text-red-600 font-medium shrink-0"
                        }
                      >
                        {c.amount > 0 ? "+" : ""}
                        {c.amount} g
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Buchen..." : "Buchen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerManager({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [activeCustomer, setActiveCustomer] = useState<CustomerRow | null>(null);

  function handleBalanceUpdated(id: string, newBalance: number) {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, creditBalance: newBalance } : c))
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
        <p className="text-muted-foreground text-sm">
          Kundenkonten und Filament-Guthaben verwalten
        </p>
      </div>

      <div className="grid gap-3">
        {customers.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{customer.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {customer.email}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <BalanceBadge balance={customer.creditBalance} />

                <span className="text-xs text-muted-foreground hidden sm:block">
                  Seit {formatDate(customer.createdAt)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveCustomer(customer)}
                >
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  Guthaben
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {customers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Keine Kundenkonten
        </div>
      )}

      {activeCustomer && (
        <CreditDialog
          customer={activeCustomer}
          onClose={() => setActiveCustomer(null)}
          onBalanceUpdated={handleBalanceUpdated}
        />
      )}
    </div>
  );
}
