"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { localeToDateLocale, formatDate } from "@/lib/utils";
import {
  BadgeEuro,
  FileDown,
  PlusCircle,
  Send,
  Wallet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  XCircle,
  CreditCard,
  Coins,
  Banknote,
} from "lucide-react";

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

type PaymentMethod = "SEPA" | "CASH" | "PAYPAL" | "CREDIT" | "CARD" | "OTHER";

export type InvoiceItemUI = {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  category: string;
  orderPartId: string | null;
};

export type PaymentUI = {
  id: string;
  amountCents: number;
  paidAt: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
};

export type InvoiceUI = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  quoteId: string | null;
  reverseOfId: string | null;
  totalCents: number;
  taxCents: number;
  kleinunternehmer: boolean;
  issuedAt: string | null;
  dueAt: string | null;
  cancelledAt: string | null;
  pdfPath: string | null;
  notes: string | null;
  createdAt: string;
  items: InvoiceItemUI[];
  payments: PaymentUI[];
  reminders: Array<{ id: string; stage: number; sentAt: string; feeCents: number }>;
};

type QuoteForInvoice = {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    taxRatePercent: number;
    source: "ESTIMATE" | "FIXED" | "ACTUAL";
    category: string;
  }>;
};

interface InvoiceCardProps {
  orderId: string;
  customerCreditCents?: number | null;
  invoices: InvoiceUI[];
  approvedQuote: QuoteForInvoice | null;
  onChanged: () => void;
}

function fmtEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function paidSum(payments: PaymentUI[]): number {
  return payments.reduce((s, p) => s + p.amountCents, 0);
}

const STATUS_TINT: Record<InvoiceStatus, string> = {
  DRAFT:
    "bg-muted text-foreground/70 border-border",
  ISSUED:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900",
  PARTIALLY_PAID:
    "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-900",
  PAID:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900",
  OVERDUE:
    "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-100 dark:border-red-900",
  CANCELLED:
    "bg-muted text-muted-foreground border-border line-through",
};

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  SEPA: Banknote,
  CASH: Coins,
  PAYPAL: Wallet,
  CREDIT: BadgeEuro,
  CARD: CreditCard,
  OTHER: Wallet,
};

export function InvoiceCard({
  orderId,
  customerCreditCents,
  invoices,
  approvedQuote,
  onChanged,
}: InvoiceCardProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const [busy, setBusy] = useState<"create" | "issue" | "cancel" | "payment" | null>(null);

  // Active invoice (most recent non-cancelled, or most recent if all cancelled)
  const active = useMemo(() => {
    const live = invoices.find((i) => i.status !== "CANCELLED");
    return live ?? invoices[0] ?? null;
  }, [invoices]);

  const draft = active?.status === "DRAFT" ? active : null;

  // Dialog state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  async function handleCreateDraft() {
    if (!approvedQuote) return;
    setBusy("create");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: approvedQuote.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }
      toast.success(t("invoice_draft_created"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoice_create_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleIssue() {
    if (!draft) return;
    setBusy("issue");
    try {
      const res = await fetch(`/api/admin/invoices/${draft.id}/issue`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }
      const issued = await res.json();
      toast.success(t("invoice_issued_toast", { number: issued.number }));
      setIssueDialogOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoice_issue_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!active || active.status === "DRAFT") return;
    setBusy("cancel");
    try {
      const res = await fetch(`/api/admin/invoices/${active.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }
      toast.success(t("invoice_cancelled_toast"));
      setCancelConfirmOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoice_cancel_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteDraft() {
    if (!draft) return;
    setBusy("cancel");
    try {
      const res = await fetch(`/api/admin/invoices/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("invoice_draft_deleted"));
      onChanged();
    } catch {
      toast.error(t("invoice_delete_failed"));
    } finally {
      setBusy(null);
    }
  }

  // No invoice and no approved quote → encourage approval flow
  if (!active && !approvedQuote) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <BadgeEuro className="h-3.5 w-3.5" />
            {t("invoice_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t("invoice_needs_approved_quote")}</p>
        </CardContent>
      </Card>
    );
  }

  // No invoice yet, but quote is approved → enable creation
  if (!active && approvedQuote) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <BadgeEuro className="h-3.5 w-3.5" />
            {t("invoice_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("invoice_create_hint", { quoteRef: approvedQuote.number ?? "v" + approvedQuote.id.slice(0, 4) })}
          </p>
          <Button size="sm" className="w-full" onClick={handleCreateDraft} disabled={busy === "create"}>
            <PlusCircle className="h-3.5 w-3.5 mr-2" />
            {busy === "create" ? t("invoice_creating") : t("invoice_create")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!active) return null;

  const paid = paidSum(active.payments);
  const remaining = Math.max(active.totalCents - paid, 0);
  const isPositive = active.totalCents > 0;
  const isCancelled = active.status === "CANCELLED";

  return (
    <>
      <Card className={isCancelled ? "opacity-70" : undefined}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <BadgeEuro className="h-3.5 w-3.5" />
            {t("invoice_title")}
          </CardTitle>
          <Badge
            variant="outline"
            className={`${STATUS_TINT[active.status]} text-[10px] tracking-wide uppercase border font-medium`}
          >
            {t(`invoice_status_${active.status}`)}
            {active.number ? ` · ${active.number}` : ""}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tabular-nums tracking-tight ${isCancelled ? "line-through" : ""}`}>
                {fmtEuro(active.totalCents, dateLocale)}
              </span>
              {active.status === "PARTIALLY_PAID" && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t("invoice_remaining", { amount: fmtEuro(remaining, dateLocale) })}
                </span>
              )}
            </div>
            {!active.kleinunternehmer && active.taxCents !== 0 && (
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {t("invoice_includes_tax", { amount: fmtEuro(active.taxCents, dateLocale) })}
              </div>
            )}
          </div>

          {/* Status-specific meta */}
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            {active.issuedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {t("invoice_issued_at", { date: formatDate(active.issuedAt, dateLocale) })}
              </div>
            )}
            {active.dueAt && active.status !== "PAID" && active.status !== "CANCELLED" && (
              <div className="flex items-center gap-1.5">
                {active.status === "OVERDUE" ? (
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                <span className={active.status === "OVERDUE" ? "text-red-700 dark:text-red-300 font-medium" : ""}>
                  {t("invoice_due_at", { date: formatDate(active.dueAt, dateLocale) })}
                </span>
              </div>
            )}
            {active.status === "PAID" && active.payments[0] && (
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                {t("invoice_paid_at", { date: formatDate(active.payments[0].paidAt, dateLocale) })}
              </div>
            )}
            {active.status === "CANCELLED" && active.cancelledAt && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />
                {t("invoice_cancelled_at", { date: formatDate(active.cancelledAt, dateLocale) })}
              </div>
            )}
          </div>

          {/* Progress bar for partial payments */}
          {active.status === "PARTIALLY_PAID" && isPositive && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                  style={{ width: `${Math.min((paid / active.totalCents) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{t("invoice_paid_label", { amount: fmtEuro(paid, dateLocale) })}</span>
                <span>{fmtEuro(active.totalCents, dateLocale)}</span>
              </div>
            </div>
          )}

          {/* Payments list (compact, only when 1+ payments) */}
          {active.payments.length > 0 && (
            <div className="space-y-1 border-t pt-2 text-[11px]">
              {active.payments.slice(0, 3).map((p) => {
                const Icon = METHOD_ICONS[p.method];
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t(`payment_method_${p.method}`)}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(p.paidAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <span className="tabular-nums font-medium shrink-0">{fmtEuro(p.amountCents, dateLocale)}</span>
                  </div>
                );
              })}
              {active.payments.length > 3 && (
                <p className="text-[10px] text-muted-foreground">+{active.payments.length - 3} {t("invoice_more_payments")}</p>
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {draft && (
              <>
                <Button
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={() => setIssueDialogOpen(true)}
                  disabled={busy !== null}
                >
                  <Send className="h-3 w-3 mr-1.5" />
                  {t("invoice_review_and_issue")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteDraft}
                  disabled={busy !== null}
                  title={t("invoice_delete_draft") as string}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}

            {active.status === "ISSUED" || active.status === "PARTIALLY_PAID" || active.status === "OVERDUE" ? (
              <Button
                size="sm"
                className="h-8 text-xs flex-1"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <BadgeEuro className="h-3 w-3 mr-1.5" />
                {t("invoice_record_payment")}
              </Button>
            ) : null}

            {active.pdfPath || active.number ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <a href={`/api/admin/invoices/${active.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-3 w-3 mr-1.5" />
                  PDF
                </a>
              </Button>
            ) : null}

            {!isCancelled && active.status !== "DRAFT" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => setCancelConfirmOpen(true)}
                title={tc("cancel") as string}
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Storno reference */}
          {active.reverseOfId && (
            <p className="text-[10px] text-muted-foreground border-t pt-2">
              {t("invoice_storno_for", { id: active.reverseOfId.slice(0, 8) })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Issue dialog with diff preview */}
      {draft && approvedQuote && (
        <InvoiceIssueDialog
          open={issueDialogOpen}
          onOpenChange={setIssueDialogOpen}
          draft={draft}
          quote={approvedQuote}
          busy={busy === "issue"}
          onConfirm={handleIssue}
        />
      )}

      {/* Payment dialog */}
      {active && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoiceId={active.id}
          remainingCents={remaining}
          customerCreditCents={customerCreditCents ?? null}
          onRecorded={() => {
            setPaymentDialogOpen(false);
            onChanged();
          }}
        />
      )}

      {/* Storno confirmation */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoice_cancel_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("invoice_cancel_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "cancel"}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={busy === "cancel"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === "cancel" ? t("invoice_cancelling") : t("invoice_confirm_storno")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Diff-Preview-Dialog ─────────────────────────────────────────

interface InvoiceIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InvoiceUI;
  quote: QuoteForInvoice;
  busy: boolean;
  onConfirm: () => void;
}

function InvoiceIssueDialog({
  open,
  onOpenChange,
  draft,
  quote,
  busy,
  onConfirm,
}: InvoiceIssueDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);

  // Pair quote items with invoice items (matched by position; ESTIMATE items may be replaced)
  const rows = useMemo(() => {
    return quote.items.map((qi, idx) => {
      const ii = draft.items[idx];
      const replaced =
        qi.source === "ESTIMATE" &&
        ii &&
        (Math.abs(ii.unitPriceCents - qi.unitPriceCents) > 0 || ii.description !== qi.description);
      return { qi, ii, replaced };
    });
  }, [quote.items, draft.items]);

  const hasReplacements = rows.some((r) => r.replaced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t("invoice_issue_dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {t("invoice_issue_dialog_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-1 border-b">
            <div>{t("invoice_diff_quote_header", { ref: quote.number ?? "v?" })}</div>
            <div />
            <div className="text-right">{t("invoice_diff_invoice_header")}</div>
          </div>

          {/* Diff rows */}
          <div className="space-y-1.5">
            {rows.map(({ qi, ii, replaced }, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-1.5 rounded-md ${replaced ? "bg-amber-50/60 dark:bg-amber-950/20 px-2" : ""}`}
              >
                {/* Quote side */}
                <div className="min-w-0">
                  <div className="text-sm truncate">{qi.description}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {qi.quantity} × {fmtEuro(qi.unitPriceCents, dateLocale)}
                    {qi.source === "ESTIMATE" && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                        <span className="h-1 w-1 rounded-full bg-amber-500" />
                        {t("quote_estimate_label")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight
                  className={`h-3.5 w-3.5 shrink-0 ${replaced ? "text-amber-600" : "text-muted-foreground/40"}`}
                />

                {/* Invoice side */}
                <div className="min-w-0 text-right">
                  {ii ? (
                    <>
                      <div className={`text-sm truncate ${replaced ? "font-medium" : ""}`}>{ii.description}</div>
                      <div className="text-[11px] tabular-nums">
                        {replaced ? (
                          <>
                            <span className="line-through text-muted-foreground">{fmtEuro(qi.unitPriceCents, dateLocale)}</span>
                            {" → "}
                            <span className="font-semibold text-amber-700 dark:text-amber-300">{fmtEuro(ii.unitPriceCents, dateLocale)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{ii.quantity} × {fmtEuro(ii.unitPriceCents, dateLocale)}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">{t("invoice_diff_dropped")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals comparison */}
          <Separator />
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-0.5">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("invoice_diff_quote_total")}</div>
              <div className="font-semibold tabular-nums">{fmtEuro(quote.totalCents, dateLocale)}</div>
            </div>
            <div className="space-y-0.5 text-right">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("invoice_diff_invoice_total")}</div>
              <div className={`font-semibold tabular-nums ${draft.totalCents !== quote.totalCents ? "text-amber-700 dark:text-amber-300" : ""}`}>
                {fmtEuro(draft.totalCents, dateLocale)}
                {draft.totalCents !== quote.totalCents && (
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                    Δ {fmtEuro(draft.totalCents - quote.totalCents, dateLocale)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasReplacements && (
            <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t("invoice_diff_replacements_hint")}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Send className="h-3.5 w-3.5 mr-2" />
            {busy ? t("invoice_issuing") : t("invoice_confirm_issue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Dialog ──────────────────────────────────────────────

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingCents: number;
  customerCreditCents: number | null;
  onRecorded: () => void;
}

function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  remainingCents,
  customerCreditCents,
  onRecorded,
}: PaymentDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);

  const [amountEuros, setAmountEuros] = useState(() => (remainingCents / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<PaymentMethod>("SEPA");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useMemo(() => {
    if (open) {
      setAmountEuros((remainingCents / 100).toFixed(2));
      setPaidAt(new Date().toISOString().split("T")[0]);
      setMethod("SEPA");
      setReference("");
      setNotes("");
    }
  }, [open, remainingCents]);

  const cents = Math.round(parseFloat(amountEuros.replace(",", ".") || "0") * 100);
  const canSubmit = cents > 0 && paidAt;
  const hasCredit = (customerCreditCents ?? 0) > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          paidAt: new Date(paidAt).toISOString(),
          method,
          reference: reference || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }
      toast.success(t("payment_recorded_toast"));
      onRecorded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("payment_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function useCreditQuick() {
    if (!customerCreditCents || customerCreditCents <= 0) return;
    const useCents = Math.min(customerCreditCents, remainingCents);
    setAmountEuros((useCents / 100).toFixed(2));
    setMethod("CREDIT");
    setReference(t("payment_credit_reference") as string);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeEuro className="h-4 w-4" />
            {t("payment_dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {t("payment_dialog_desc", { amount: fmtEuro(remainingCents, dateLocale) })}
          </DialogDescription>
        </DialogHeader>

        {hasCredit && (
          <button
            onClick={useCreditQuick}
            className="w-full text-left rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <BadgeEuro className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <span className="font-medium">{t("payment_use_credit")}</span>
              </div>
              <span className="text-sm tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                {fmtEuro(customerCreditCents ?? 0, dateLocale)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-200/80 mt-0.5">
              {t("payment_use_credit_hint")}
            </p>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">{t("payment_amount_label")}</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-date">{t("payment_date_label")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-method">{t("payment_method_label")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger id="payment-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["SEPA", "CASH", "CARD", "PAYPAL", "CREDIT", "OTHER"] as PaymentMethod[]).map((m) => {
                const Icon = METHOD_ICONS[m];
                return (
                  <SelectItem key={m} value={m}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t(`payment_method_${m}`)}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-reference">{t("payment_reference_label")}</Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t("payment_reference_placeholder") as string}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-notes">{t("payment_notes_label")}</Label>
          <Textarea
            id="payment-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? t("payment_submitting") : t("payment_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
