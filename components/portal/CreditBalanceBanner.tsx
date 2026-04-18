"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";

interface CreditEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface CreditBalanceBannerProps {
  balance: number;
  recentCredits: CreditEntry[];
}

export function CreditBalanceBanner({ balance, recentCredits }: CreditBalanceBannerProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filamentguthaben</span>
        </div>
        <span className="text-lg font-bold">
          {balance > 0 ? `${balance} g` : (
            <span className="text-muted-foreground text-sm font-normal">Kein Guthaben verfügbar</span>
          )}
        </span>
      </div>

      {recentCredits.length > 0 && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
        </button>
      )}

      {showHistory && recentCredits.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          {recentCredits.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("de-DE")}
                </span>
                <p className="text-muted-foreground truncate">{c.reason}</p>
              </div>
              <span className={c.amount > 0 ? "text-green-600 font-medium shrink-0" : "text-red-600 font-medium shrink-0"}>
                {c.amount > 0 ? "+" : ""}{c.amount} g
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
