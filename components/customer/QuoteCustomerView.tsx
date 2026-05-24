"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations, useLocale } from "next-intl";
import { FileText, Sparkles, Download } from "lucide-react";
import { localeToDateLocale } from "@/lib/utils";

export type QuoteCustomer = {
  id: string;
  number?: string | null;
  version: number;
  status: "SENT" | "APPROVED" | "REJECTED";
  totalCents: number;
  taxCents: number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    taxRatePercent: number;
    category: string;
    source: "ESTIMATE" | "FIXED" | "ACTUAL";
  }>;
};

function fmtEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function QuoteCustomerView({ quote, pdfUrl }: { quote: QuoteCustomer; pdfUrl?: string | null }) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);

  const hasEstimates = quote.items.some((it) => it.source === "ESTIMATE");

  const statusColor =
    quote.status === "APPROVED"
      ? "bg-green-100 text-green-700 border-green-200"
      : quote.status === "REJECTED"
        ? "bg-red-100 text-red-700 border-red-200"
        : "bg-amber-100 text-amber-700 border-amber-200";

  const netCents = quote.totalCents - quote.taxCents;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("quote_title")}
            {quote.number ? (
              <span className="text-sm font-normal text-muted-foreground">· {quote.number}</span>
            ) : (
              <span className="text-sm font-normal text-muted-foreground">· v{quote.version}</span>
            )}
          </CardTitle>
          {quote.sentAt && (
            <p className="text-xs text-muted-foreground">
              {t("quote_sent_at", {
                date: new Date(quote.sentAt).toLocaleDateString(dateLocale),
              })}
            </p>
          )}
          {quote.validUntil && quote.status === "SENT" && (
            <p className="text-xs text-muted-foreground">
              {t("quote_valid_until", {
                date: new Date(quote.validUntil).toLocaleDateString(dateLocale),
              })}
            </p>
          )}
        </div>
        <Badge variant="outline" className={statusColor}>
          {t(`quote_status_${quote.status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left py-1 pr-2">{t("quote_description")}</th>
                <th className="text-right py-1 px-1 w-12">{t("quote_quantity")}</th>
                <th className="text-right py-1 px-1 w-20">{t("quote_unit_price")}</th>
                <th className="text-right py-1 pl-1 w-24">{t("quote_line_total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quote.items.map((it) => {
                const lineCents = Math.round(it.quantity * it.unitPriceCents);
                return (
                  <tr key={it.id} className="text-sm">
                    <td className="py-2 pr-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{it.description}</p>
                          {it.source === "ESTIMATE" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 mt-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              {t("quote_estimate_label")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-2 px-1 tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="text-right py-2 px-1 tabular-nums">
                      {fmtEuro(it.unitPriceCents, dateLocale)}
                    </td>
                    <td className="text-right py-2 pl-1 tabular-nums font-medium">
                      {fmtEuro(lineCents, dateLocale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-xs text-muted-foreground">
                <td colSpan={3} className="text-right pt-2">{t("quote_net")}</td>
                <td className="text-right pt-2 tabular-nums">{fmtEuro(netCents, dateLocale)}</td>
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td colSpan={3} className="text-right">{t("quote_tax_label")}</td>
                <td className="text-right tabular-nums">{fmtEuro(quote.taxCents, dateLocale)}</td>
              </tr>
              <tr className="font-semibold border-t">
                <td colSpan={3} className="text-right pt-2">{t("quote_total")}</td>
                <td className="text-right pt-2 tabular-nums">{fmtEuro(quote.totalCents, dateLocale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {hasEstimates && (
          <p className="text-xs text-muted-foreground italic">
            {t("quote_estimate_hint")}
          </p>
        )}
        {pdfUrl && (
          <div className="pt-1">
            <Button asChild variant="outline" size="sm">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                {t("quote_download_pdf")}
              </a>
            </Button>
          </div>
        )}
        {quote.status === "REJECTED" && quote.rejectionReason && (
          <p className="text-xs text-red-700">
            {t("quote_rejection_recorded", { reason: quote.rejectionReason })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
