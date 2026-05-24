import path from "path";
import { readFile } from "fs/promises";
import QRCode from "qrcode";
import { getSettings } from "@/lib/settings";
import type { BillingBranding, BillingDocumentData, BillingItemData } from "@/components/billing/BillingDocumentPDF";

interface QuoteForPdf {
  id: string;
  number?: string | null;
  version: number;
  status: string;
  totalCents: number;
  taxCents: number;
  validUntil?: Date | null;
  sentAt?: Date | null;
  approvedAt?: Date | null;
  createdAt: Date;
  notes?: string | null;
  rejectionReason?: string | null;
  items: Array<{
    position: number;
    description: string;
    quantity: number | { toString(): string };
    unitPriceCents: number;
    taxRatePercent: number | { toString(): string };
  }>;
  order: {
    customerName: string;
    customerEmail: string;
  };
}

function decimalToNumber(value: number | { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

async function loadLogoDataUrl(publicPath: string | undefined): Promise<string | null> {
  if (!publicPath) return null;
  try {
    const cleaned = publicPath.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", cleaned);
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".svg" ? "image/svg+xml" : "application/octet-stream";
    if (mime === "image/svg+xml") return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildBranding(settings: Record<string, string>): Promise<BillingBranding> {
  const addressLines = [
    settings.billing_company_address_line1,
    settings.billing_company_address_line2,
    [settings.billing_company_city, settings.billing_company_country].filter(Boolean).join(" · "),
  ].filter((line): line is string => Boolean(line && line.trim()));

  const logoDataUrl = await loadLogoDataUrl(settings.billing_logo_url);

  return {
    logoDataUrl,
    companyName: settings.billing_company_name || settings.company_name || "",
    addressLines,
    taxId: settings.billing_tax_id || undefined,
    steuerNr: settings.billing_steuer_nr || undefined,
    bank: {
      name: settings.billing_bank_name || "",
      iban: settings.billing_iban || "",
      bic: settings.billing_bic || "",
    },
    kleinunternehmer: settings.billing_kleinunternehmer === "true",
    footer: settings.billing_footer_de || settings.billing_company_name || settings.company_name || "",
    accentColor: settings.billing_accent_color || "#d97706",
    contactEmail: settings.contact_email || undefined,
  };
}

export async function buildBrandingLocalized(locale: "de" | "en"): Promise<BillingBranding> {
  const settings = await getSettings();
  const branding = await buildBranding(settings);
  if (locale === "en" && settings.billing_footer_en) {
    branding.footer = settings.billing_footer_en;
  }
  return branding;
}

export function quoteToDocumentData(quote: QuoteForPdf, displayNumber: string): BillingDocumentData {
  const items: BillingItemData[] = quote.items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => {
      const qty = decimalToNumber(item.quantity);
      const lineCents = Math.round(qty * item.unitPriceCents);
      return {
        position: idx + 1,
        description: item.description,
        quantity: qty,
        unitPriceCents: item.unitPriceCents,
        taxRatePercent: decimalToNumber(item.taxRatePercent),
        lineCents,
      };
    });

  const netCents = quote.totalCents - quote.taxCents;

  return {
    number: displayNumber,
    date: (quote.sentAt ?? quote.createdAt).toISOString(),
    validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
    items,
    netCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    customer: {
      name: quote.order.customerName,
      email: quote.order.customerEmail,
    },
    notes: quote.notes ?? null,
    rejectionReason: quote.rejectionReason ?? null,
  };
}

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export async function buildSepaQrDataUrl(opts: {
  bic: string;
  beneficiaryName: string;
  iban: string;
  amountCents: number;
  reference: string;
}): Promise<string | null> {
  const iban = normalizeIban(opts.iban);
  if (!iban || !opts.beneficiaryName) return null;
  const amount = (opts.amountCents / 100).toFixed(2);
  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    opts.bic || "",
    opts.beneficiaryName.slice(0, 70),
    iban,
    `EUR${amount}`,
    "",
    opts.reference.slice(0, 35),
    "",
  ];
  const payload = lines.join("\n");
  try {
    return await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 });
  } catch {
    return null;
  }
}

export function formatQuoteNumber(prefix: string, year: number, counter: number): string {
  const safePrefix = prefix || "ANG-";
  return `${safePrefix}${year}-${String(counter).padStart(4, "0")}`;
}

interface InvoiceForPdf {
  id: string;
  number?: string | null;
  status: string;
  totalCents: number;
  taxCents: number;
  issuedAt?: Date | null;
  dueAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  notes?: string | null;
  kleinunternehmer: boolean;
  items: Array<{
    position: number;
    description: string;
    quantity: number | { toString(): string };
    unitPriceCents: number;
    taxRatePercent: number | { toString(): string };
  }>;
  order: {
    customerName: string;
    customerEmail: string;
  };
}

export function invoiceToDocumentData(
  invoice: InvoiceForPdf,
  displayNumber: string
): BillingDocumentData {
  const items: BillingItemData[] = invoice.items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => {
      const qty = decimalToNumber(item.quantity);
      const lineCents = Math.round(qty * item.unitPriceCents);
      return {
        position: idx + 1,
        description: item.description,
        quantity: qty,
        unitPriceCents: item.unitPriceCents,
        taxRatePercent: decimalToNumber(item.taxRatePercent),
        lineCents,
      };
    });

  return {
    number: displayNumber,
    date: (invoice.issuedAt ?? invoice.createdAt).toISOString(),
    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    items,
    netCents: invoice.totalCents - invoice.taxCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    customer: {
      name: invoice.order.customerName,
      email: invoice.order.customerEmail,
    },
    notes: invoice.notes ?? null,
  };
}
