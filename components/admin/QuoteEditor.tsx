"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localeToDateLocale } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Send,
  Trash2,
  FilePlus,
  Pencil,
  Receipt,
  FileDown,
  Wand2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type Category =
  | "FILAMENT"
  | "HARDWARE"
  | "POST_PROCESSING"
  | "DESIGN"
  | "SHIPPING"
  | "DISCOUNT"
  | "OTHER";
type Source = "ESTIMATE" | "FIXED" | "ACTUAL";
type Status = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";

export type QuoteItemUI = {
  id?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  category: Category;
  source: Source;
  orderPartId?: string | null;
};

export type QuoteUI = {
  id: string;
  number?: string | null;
  version: number;
  status: Status;
  totalCents: number;
  taxCents: number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  items: QuoteItemUI[];
};

const STATUS_STYLES: Record<Status, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  SENT: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  APPROVED:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  REJECTED:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
  EXPIRED:
    "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  SUPERSEDED: "bg-muted text-muted-foreground border-border opacity-70",
};

const CATEGORIES: Category[] = [
  "FILAMENT",
  "HARDWARE",
  "POST_PROCESSING",
  "DESIGN",
  "SHIPPING",
  "DISCOUNT",
  "OTHER",
];

const SOURCES: Source[] = ["ESTIMATE", "FIXED", "ACTUAL"];

function fmtEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatNumber(value: number, decimals?: number): string {
  if (decimals !== undefined) return value.toFixed(decimals).replace(".", ",");
  return String(value).replace(".", ",");
}

/**
 * Text input that holds raw typed value during focus and only parses on blur.
 * Avoids the controlled-number-input bug where `toFixed` snaps back to a
 * formatted value on every keystroke and eats user input.
 */
function NumberCell({
  value,
  onChange,
  decimals,
  suffix,
  className,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  decimals?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const display = editing !== null ? editing : formatNumber(value, decimals);

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={className}
        value={display}
        disabled={disabled}
        onFocus={(e) => {
          setEditing(formatNumber(value, decimals));
          e.target.select();
        }}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={() => {
          if (editing !== null) {
            const cleaned = editing.replace(/\s/g, "").replace(",", ".");
            const num = parseFloat(cleaned);
            onChange(isNaN(num) ? 0 : num);
            setEditing(null);
          }
        }}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

function computeLineCents(it: QuoteItemUI): number {
  return Math.round(it.quantity * it.unitPriceCents);
}

function computeTotals(items: QuoteItemUI[]) {
  let net = 0;
  let tax = 0;
  for (const it of items) {
    const line = computeLineCents(it);
    net += line;
    tax += Math.round((line * it.taxRatePercent) / 100);
  }
  return { netCents: net, taxCents: tax, totalCents: net + tax };
}

export function QuoteEditor({
  orderId,
  initialQuotes,
  onChanged,
}: {
  orderId: string;
  initialQuotes: QuoteUI[];
  onChanged?: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);

  const [quotes, setQuotes] = useState<QuoteUI[]>(initialQuotes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const active = quotes.find((q) =>
    ["DRAFT", "SENT", "APPROVED", "REJECTED"].includes(q.status)
  );
  const draft = active?.status === "DRAFT" ? active : null;

  function syncQuote(updated: QuoteUI) {
    setQuotes((prev) => {
      const idx = prev.findIndex((q) => q.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function handleCreate(cloneFromQuoteId?: string) {
    setBusy("create");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [],
          ...(cloneFromQuoteId ? { cloneFromQuoteId } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Fehler beim Erstellen");
        return;
      }
      const created: QuoteUI = await res.json();
      setQuotes((prev) => {
        if (cloneFromQuoteId) {
          return [
            created,
            ...prev.map((q) =>
              q.status === "DRAFT" || q.status === "SENT"
                ? { ...q, status: "SUPERSEDED" as Status }
                : q
            ),
          ];
        }
        return [created, ...prev];
      });
      setDialogOpen(true);
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* Compact inline summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            {t("quote_title")}
          </CardTitle>
          {active && (
            <Badge
              variant="outline"
              className={`${STATUS_STYLES[active.status]} text-[10px] tracking-wide uppercase border font-medium`}
            >
              {t(`quote_status_${active.status}`)} · {active.number ?? `v${active.version}`}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!active && (
            <>
              <p className="text-xs text-muted-foreground">{t("quote_no_quote")}</p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleCreate()}
                disabled={busy === "create"}
              >
                <FilePlus className="h-3.5 w-3.5 mr-2" />
                {busy === "create" ? t("quote_creating") : t("quote_create")}
              </Button>
            </>
          )}

          {active && (
            <>
              <div className="space-y-0.5">
                <div className="text-2xl font-semibold tabular-nums tracking-tight">
                  {fmtEuro(active.totalCents, dateLocale)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {t("quote_net")} {fmtEuro(active.totalCents - active.taxCents, dateLocale)} ·{" "}
                  {t("quote_tax_label")} {fmtEuro(active.taxCents, dateLocale)}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  {active.items.length} {active.items.length === 1 ? "Posten" : "Posten"}
                </span>
                {active.validUntil && active.status === "SENT" && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {t("quote_valid_until")}{" "}
                      {new Date(active.validUntil).toLocaleDateString(dateLocale)}
                    </span>
                  </>
                )}
                {active.sentAt && active.status === "SENT" && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {t("quote_sent_at", {
                        date: new Date(active.sentAt).toLocaleDateString(dateLocale),
                      })}
                    </span>
                  </>
                )}
              </div>

              {active.status === "REJECTED" && active.rejectionReason && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-2.5 py-1.5">
                  <p className="text-[11px] text-red-800 dark:text-red-200">
                    {active.rejectionReason}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {draft && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-1"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1.5" />
                    {tc("edit")}
                  </Button>
                )}
                {!draft && active.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-1"
                    onClick={() => handleCreate(active.id)}
                    disabled={busy === "create"}
                  >
                    <FilePlus className="h-3 w-3 mr-1.5" />
                    {t("quote_new_version")}
                  </Button>
                )}
                {!draft && active.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => setDialogOpen(true)}
                  >
                    Ansehen
                  </Button>
                )}
                {active.number && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    asChild
                  >
                    <a
                      href={`/api/admin/quotes/${active.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileDown className="h-3 w-3 mr-1.5" />
                      PDF
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {active && (
        <QuoteEditDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          orderId={orderId}
          quote={active}
          onSaved={(q) => {
            syncQuote(q);
            onChanged?.();
          }}
          onSent={async () => {
            const fresh: QuoteUI[] = await fetch(`/api/admin/orders/${orderId}/quotes`).then(
              (r) => r.json()
            );
            setQuotes(fresh);
            setDialogOpen(false);
            onChanged?.();
          }}
          onDeleted={(id) => {
            setQuotes((prev) => prev.filter((q) => q.id !== id));
            setDialogOpen(false);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function QuoteEditDialog({
  open,
  onOpenChange,
  orderId,
  quote,
  onSaved,
  onSent,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  quote: QuoteUI;
  onSaved: (q: QuoteUI) => void;
  onSent: () => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);

  const isDraft = quote.status === "DRAFT";

  const [items, setItems] = useState<QuoteItemUI[]>(quote.items.map((it) => ({ ...it })));
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [validUntil, setValidUntil] = useState(
    quote.validUntil ? quote.validUntil.slice(0, 10) : ""
  );
  const [busy, setBusy] = useState<string | null>(null);

  // Reset state when dialog opens with a different quote
  const [seenQuoteId, setSeenQuoteId] = useState(quote.id);
  if (seenQuoteId !== quote.id || (open && items.length === 0 && quote.items.length > 0)) {
    if (seenQuoteId !== quote.id) {
      setSeenQuoteId(quote.id);
      setItems(quote.items.map((it) => ({ ...it })));
      setNotes(quote.notes ?? "");
      setValidUntil(quote.validUntil ? quote.validUntil.slice(0, 10) : "");
    }
  }

  const totals = computeTotals(items);
  void orderId;

  function updateItem(idx: number, patch: Partial<QuoteItemUI>) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        taxRatePercent: 19,
        category: "OTHER",
        source: "FIXED",
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save(): Promise<QuoteUI | null> {
    setBusy("save");
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPriceCents: Math.round(it.unitPriceCents),
            taxRatePercent: Number(it.taxRatePercent),
            category: it.category,
            source: it.source,
            orderPartId: it.orderPartId ?? null,
          })),
          notes: notes || null,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Fehler beim Speichern");
        return null;
      }
      const updated: QuoteUI = await res.json();
      onSaved(updated);
      return updated;
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    const saved = await save();
    if (saved) {
      toast.success(t("quote_save"));
      onOpenChange(false);
    }
  }

  async function handleSyncParts() {
    setBusy("sync");
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/sync-parts`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? t("quote_sync_failed"));
        return;
      }
      const { added } = await res.json();
      // Refetch the quote with updated items
      const freshRes = await fetch(`/api/admin/quotes/${quote.id}`);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        setItems(
          fresh.items.map((it: { id: string; description: string; quantity: number | string; unitPriceCents: number; taxRatePercent: number | string; category: Category; source: Source; orderPartId: string | null }) => ({
            id: it.id,
            description: it.description,
            quantity: Number(it.quantity),
            unitPriceCents: it.unitPriceCents,
            taxRatePercent: Number(it.taxRatePercent),
            category: it.category,
            source: it.source,
            orderPartId: it.orderPartId,
          }))
        );
        onSaved(fresh);
      }
      if (added > 0) toast.success(t("quote_sync_added", { count: added }));
      else toast.info(t("quote_sync_none"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (items.length === 0 || items.some((it) => !it.description.trim())) {
      toast.error(t("quote_no_items"));
      return;
    }
    const saved = await save();
    if (!saved) return;
    setBusy("send");
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Fehler beim Senden");
        return;
      }
      toast.success(t("quote_send"));
      onSent();
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Fehler beim Löschen");
        return;
      }
      onDeleted(quote.id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-4.5 w-4.5 text-primary" />
                {t("quote_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("quote_version", { version: quote.version })}
                {" · "}
                <span className={isDraft ? "text-muted-foreground" : "text-foreground"}>
                  {t(`quote_status_${quote.status}`)}
                </span>
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={`${STATUS_STYLES[quote.status]} text-[10px] tracking-wide uppercase border font-medium`}
            >
              {t(`quote_status_${quote.status}`)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Items section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("quote_items")}
              </Label>
              {isDraft && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={handleSyncParts}
                    disabled={busy !== null}
                    title={t("quote_sync_hint") as string}
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    {busy === "sync" ? t("quote_syncing") : t("quote_sync_from_parts")}
                  </Button>
                  {items.length === 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={addItem}
                      disabled={busy !== null}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t("quote_add_item")}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">{t("quote_no_items")}</p>
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-muted/40">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left font-medium px-3 py-2">
                        {t("quote_item_description")}
                      </th>
                      <th className="text-right font-medium px-2 py-2 w-[72px]">
                        {t("quote_item_quantity")}
                      </th>
                      <th className="text-right font-medium px-2 py-2 w-[112px]">
                        {t("quote_item_unit_price")}
                      </th>
                      <th className="text-right font-medium px-2 py-2 w-[80px]">
                        {t("quote_item_tax")}
                      </th>
                      <th className="text-left font-medium px-2 py-2 w-[144px]">
                        {t("quote_item_category")}
                      </th>
                      <th className="text-left font-medium px-2 py-2 w-[124px]">
                        {t("quote_item_source")}
                      </th>
                      <th className="text-right font-medium px-3 py-2 w-[96px]">
                        {t("quote_item_total")}
                      </th>
                      <th className="w-9 px-1 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr
                        key={it.id ?? idx}
                        className="border-t border-border/60 hover:bg-muted/20 group"
                      >
                        <td className="p-0">
                          <div className="relative flex items-center">
                            <Input
                              className="h-10 text-sm border-0 shadow-none bg-transparent rounded-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background px-3 pr-7"
                              placeholder={t("quote_item_description")}
                              value={it.description}
                              disabled={!isDraft}
                              onChange={(e) =>
                                updateItem(idx, { description: e.target.value })
                              }
                            />
                            {it.source === "ESTIMATE" && it.unitPriceCents === 0 && (
                              <span
                                title={t("quote_incomplete_estimate") as string}
                                className="absolute right-2 text-amber-600 dark:text-amber-400 pointer-events-none"
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-0">
                          <NumberCell
                            value={it.quantity}
                            onChange={(n) => updateItem(idx, { quantity: n })}
                            className="h-10 text-sm text-right tabular-nums border-0 shadow-none bg-transparent rounded-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background px-2"
                            disabled={!isDraft}
                            ariaLabel={t("quote_item_quantity")}
                          />
                        </td>
                        <td className="p-0">
                          <NumberCell
                            value={it.unitPriceCents / 100}
                            onChange={(n) =>
                              updateItem(idx, { unitPriceCents: Math.round(n * 100) })
                            }
                            decimals={2}
                            suffix="€"
                            className="h-10 text-sm text-right tabular-nums border-0 shadow-none bg-transparent rounded-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background px-2 pr-6"
                            disabled={!isDraft}
                            ariaLabel={t("quote_item_unit_price")}
                          />
                        </td>
                        <td className="p-0">
                          <NumberCell
                            value={it.taxRatePercent}
                            onChange={(n) => updateItem(idx, { taxRatePercent: n })}
                            suffix="%"
                            className="h-10 text-sm text-right tabular-nums border-0 shadow-none bg-transparent rounded-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background px-2 pr-5"
                            disabled={!isDraft}
                            ariaLabel={t("quote_item_tax")}
                          />
                        </td>
                        <td className="p-0">
                          <Select
                            value={it.category}
                            disabled={!isDraft}
                            onValueChange={(v) =>
                              updateItem(idx, { category: v as Category })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm border-0 shadow-none bg-transparent rounded-none focus:ring-1 focus:ring-ring px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {t(`quote_category_${c}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-0">
                          <Select
                            value={it.source}
                            disabled={!isDraft}
                            onValueChange={(v) =>
                              updateItem(idx, { source: v as Source })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm border-0 shadow-none bg-transparent rounded-none focus:ring-1 focus:ring-ring px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SOURCES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {t(`quote_source_${s}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="text-right tabular-nums px-3 text-foreground/80">
                          {fmtEuro(computeLineCents(it), dateLocale)}
                        </td>
                        <td className="p-0 text-center">
                          {isDraft && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                              onClick={() => removeItem(idx)}
                              aria-label={t("quote_item_remove")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {isDraft && (
                      <tr className="border-t border-border/60">
                        <td colSpan={8} className="p-0">
                          <button
                            type="button"
                            onClick={addItem}
                            disabled={busy !== null}
                            className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors px-3 py-2 flex items-center gap-1.5"
                          >
                            <Plus className="h-3 w-3" />
                            {t("quote_add_item")}
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Per-row subtotal preview (draft mode shows current totals only at the bottom) */}
            {items.length > 0 && (
              <div className="rounded-md bg-muted/30 px-4 py-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{t("quote_net")}</span>
                  <span>{fmtEuro(totals.netCents, dateLocale)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{t("quote_tax_label")}</span>
                  <span>{fmtEuro(totals.taxCents, dateLocale)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-1.5 mt-1.5 border-t border-border/60 tabular-nums">
                  <span>{t("quote_total")}</span>
                  <span>{fmtEuro(totals.totalCents, dateLocale)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Notes + valid until */}
          <section className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="quote-notes"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("quote_notes")}
              </Label>
              <Textarea
                id="quote-notes"
                className="text-sm min-h-20 resize-y"
                value={notes}
                disabled={!isDraft}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="quote-valid"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("quote_valid_until")}
              </Label>
              <Input
                id="quote-valid"
                type="date"
                className="text-sm"
                value={validUntil}
                disabled={!isDraft}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 sm:justify-between gap-2">
          <div className="flex">
            {isDraft && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={busy !== null}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("quote_delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("quote_delete")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("quote_delete_confirm")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("quote_delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy !== null}
            >
              {tc("cancel")}
            </Button>
            {isDraft && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={busy !== null}
                >
                  {busy === "save" ? t("quote_saving") : t("quote_save")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={busy !== null || items.length === 0}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {busy === "send" ? t("quote_sending") : t("quote_send")}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
