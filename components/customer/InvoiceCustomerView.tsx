"use client";

import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { localeToDateLocale, formatDate } from "@/lib/utils";
import {
  BadgeEuro,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Banknote,
} from "lucide-react";

type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export type InvoiceCustomer = {
  id: string;
  number: string;
  status: InvoiceStatus;
  totalCents: number;
  taxCents: number;
  paidCents: number;
  remainingCents: number;
  issuedAt: string;
  dueAt: string | null;
  kleinunternehmer: boolean;
  bank: {
    name: string;
    iban: string;
    bic: string;
  } | null;
};

const STATUS_TINT: Record<InvoiceStatus, string> = {
  ISSUED:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900",
  PARTIALLY_PAID:
    "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-900",
  PAID:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900",
  OVERDUE:
    "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-100 dark:border-red-900",
};

function fmtEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

interface InvoiceCustomerViewProps {
  invoice: InvoiceCustomer;
  pdfUrl?: string | null;
}

export function InvoiceCustomerView({ invoice, pdfUrl }: InvoiceCustomerViewProps) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const showBank = invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE";
  const isOverdue = invoice.status === "OVERDUE";

  return (
    <Card className={isOverdue ? "border-red-300 dark:border-red-800" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeEuro className="h-4 w-4" />
            {t("invoice_title")}
            <span className="text-sm font-normal text-muted-foreground">· {invoice.number}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {t("invoice_issued_at", { date: formatDate(invoice.issuedAt, dateLocale) })}
          </p>
        </div>
        <Badge variant="outline" className={STATUS_TINT[invoice.status]}>
          {invoice.status === "PAID" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
          {isOverdue && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
          {t(`invoice_status_${invoice.status}`)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Total + due */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">
              {fmtEuro(invoice.totalCents, dateLocale)}
            </span>
            {invoice.status === "PARTIALLY_PAID" && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("invoice_outstanding", { amount: fmtEuro(invoice.remainingCents, dateLocale) })}
              </span>
            )}
          </div>
          {!invoice.kleinunternehmer && invoice.taxCents > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("invoice_includes_tax", { amount: fmtEuro(invoice.taxCents, dateLocale) })}
            </p>
          )}
          {invoice.dueAt && invoice.status !== "PAID" && (
            <p className={`text-xs flex items-center gap-1.5 ${isOverdue ? "text-red-700 dark:text-red-300 font-medium" : "text-muted-foreground"}`}>
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {t("invoice_due_at", { date: formatDate(invoice.dueAt, dateLocale) })}
            </p>
          )}
        </div>

        {/* Progress for partial */}
        {invoice.status === "PARTIALLY_PAID" && invoice.totalCents > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                style={{ width: `${Math.min((invoice.paidCents / invoice.totalCents) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{t("invoice_paid_label", { amount: fmtEuro(invoice.paidCents, dateLocale) })}</span>
              <span>{fmtEuro(invoice.totalCents, dateLocale)}</span>
            </div>
          </div>
        )}

        {/* Bank info when payment expected */}
        {showBank && invoice.bank && invoice.bank.iban && (
          <>
            <Separator />
            <div className={`rounded-md p-3 space-y-1 text-sm ${isOverdue ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900" : "bg-muted/50"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Banknote className="h-3 w-3" />
                {t("invoice_bank_details")}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {invoice.bank.name && (
                  <>
                    <dt className="text-muted-foreground">{t("invoice_bank_name")}</dt>
                    <dd>{invoice.bank.name}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">IBAN</dt>
                <dd className="font-mono tabular-nums">{invoice.bank.iban}</dd>
                {invoice.bank.bic && (
                  <>
                    <dt className="text-muted-foreground">BIC</dt>
                    <dd className="font-mono">{invoice.bank.bic}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t("invoice_reference")}</dt>
                <dd className="font-mono font-semibold">{invoice.number}</dd>
              </dl>
            </div>
          </>
        )}

        {/* PDF link */}
        {pdfUrl && (
          <div>
            <Button asChild variant="outline" size="sm">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                {t("invoice_download_pdf")}
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
