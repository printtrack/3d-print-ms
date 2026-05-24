import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

export interface BillingItemData {
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  lineCents: number;
}

export interface BillingDocumentData {
  number: string;
  date: string;
  validUntil?: string | null;
  dueAt?: string | null;
  items: BillingItemData[];
  netCents: number;
  taxCents: number;
  totalCents: number;
  customer: {
    name: string;
    email: string;
    addressLines?: string[];
  };
  notes?: string | null;
  rejectionReason?: string | null;
  sepaQrDataUrl?: string | null;
}

export interface BillingBranding {
  logoDataUrl?: string | null;
  companyName: string;
  addressLines: string[];
  taxId?: string;
  steuerNr?: string;
  bank: { name: string; iban: string; bic: string };
  kleinunternehmer: boolean;
  footer: string;
  accentColor: string;
  contactEmail?: string;
}

export interface BillingDocumentPDFProps {
  kind: "quote" | "invoice";
  document: BillingDocumentData;
  branding: BillingBranding;
  locale: "de" | "en";
}

const L = {
  de: {
    quote: "Angebot",
    invoice: "Rechnung",
    quoteNumber: "Angebots-Nr.",
    invoiceNumber: "Rechnungs-Nr.",
    date: "Datum",
    validUntil: "Gültig bis",
    dueAt: "Zahlbar bis",
    pos: "Pos.",
    description: "Beschreibung",
    quantity: "Menge",
    unitPrice: "Einzelpreis",
    tax: "MwSt.",
    lineTotal: "Gesamt",
    net: "Zwischensumme (netto)",
    taxTotal: "MwSt.",
    grandTotal: "Gesamtbetrag",
    notes: "Anmerkungen",
    rejection: "Ablehnungsgrund",
    bank: "Bankverbindung",
    iban: "IBAN",
    bic: "BIC",
    page: "Seite",
    of: "von",
    kleinunternehmerHint:
      "Gemäß §19 UStG wird keine Umsatzsteuer berechnet.",
    contact: "Kontakt",
    taxIdLabel: "USt-IdNr.",
    steuerNrLabel: "Steuer-Nr.",
    quoteIntro:
      "wir freuen uns über Ihre Anfrage und unterbreiten Ihnen folgendes Angebot:",
    invoiceIntro:
      "vielen Dank für Ihren Auftrag. Hiermit stellen wir Ihnen folgende Leistungen in Rechnung:",
    paymentNote: "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf folgendes Konto.",
  },
  en: {
    quote: "Quote",
    invoice: "Invoice",
    quoteNumber: "Quote No.",
    invoiceNumber: "Invoice No.",
    date: "Date",
    validUntil: "Valid until",
    dueAt: "Due by",
    pos: "Pos.",
    description: "Description",
    quantity: "Qty",
    unitPrice: "Unit price",
    tax: "VAT",
    lineTotal: "Total",
    net: "Subtotal (net)",
    taxTotal: "VAT",
    grandTotal: "Grand total",
    notes: "Notes",
    rejection: "Rejection reason",
    bank: "Bank details",
    iban: "IBAN",
    bic: "BIC",
    page: "Page",
    of: "of",
    kleinunternehmerHint:
      "No VAT is charged pursuant to §19 UStG (German small business rule).",
    contact: "Contact",
    taxIdLabel: "VAT ID",
    steuerNrLabel: "Tax No.",
    quoteIntro:
      "thank you for your inquiry — please find our quote below:",
    invoiceIntro:
      "thank you for your order. Please find our invoice for the rendered services below:",
    paymentNote: "Please transfer the amount to the account below, quoting the invoice number.",
  },
} as const;

function fmtMoney(cents: number, locale: "de" | "en"): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function fmtDate(iso: string | null | undefined, locale: "de" | "en"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtQty(value: number, locale: "de" | "en"): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    maximumFractionDigits: 3,
  }).format(value);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  recipient: {
    width: 240,
    marginTop: 80,
  },
  recipientSender: {
    fontSize: 7,
    color: "#6b7280",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9ca3af",
    paddingBottom: 1,
    marginBottom: 6,
  },
  recipientLine: { fontSize: 10, lineHeight: 1.35 },
  companyBlock: { width: 220, textAlign: "right" },
  logo: {
    maxHeight: 50,
    maxWidth: 180,
    marginLeft: "auto",
    marginBottom: 8,
    objectFit: "contain",
  },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  companyMeta: { fontSize: 8, color: "#374151", lineHeight: 1.4 },
  titleBlock: { marginTop: 30 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  titleMetaRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 24,
  },
  titleMetaItem: { fontSize: 9, color: "#374151" },
  titleMetaLabel: { color: "#6b7280", marginRight: 4 },
  accentLine: {
    height: 2,
    marginTop: 10,
    marginBottom: 18,
  },
  intro: { marginBottom: 14, fontSize: 10, lineHeight: 1.45 },
  table: { marginTop: 4 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textTransform: "uppercase",
    color: "#374151",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    fontSize: 9,
  },
  colPos: { width: 24, textAlign: "left" },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 50, textAlign: "right" },
  colUnit: { width: 70, textAlign: "right" },
  colTax: { width: 40, textAlign: "right" },
  colTotal: { width: 70, textAlign: "right" },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 240,
    marginTop: 14,
    fontSize: 9.5,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  kleinunternehmerNote: {
    marginTop: 14,
    fontSize: 9,
    color: "#374151",
    fontStyle: "italic",
  },
  notesBlock: {
    marginTop: 22,
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.4,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  bankBlock: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bankInfo: { fontSize: 9, lineHeight: 1.45 },
  bankLabel: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  qr: { width: 90, height: 90 },
  footer: {
    position: "absolute",
    left: 50,
    right: 50,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#6b7280",
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    paddingTop: 6,
  },
  pageNumber: {},
});

export function BillingDocumentPDF({ kind, document: doc, branding, locale }: BillingDocumentPDFProps) {
  const t = L[locale];
  const isQuote = kind === "quote";
  const showTaxColumn = !branding.kleinunternehmer;
  const senderInline = [
    branding.companyName,
    ...branding.addressLines.filter(Boolean),
  ]
    .join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.recipient}>
            <Text style={styles.recipientSender}>{senderInline}</Text>
            <Text style={styles.recipientLine}>{doc.customer.name}</Text>
            {(doc.customer.addressLines ?? []).map((line, idx) => (
              <Text key={idx} style={styles.recipientLine}>{line}</Text>
            ))}
            <Text style={[styles.recipientLine, { color: "#6b7280", marginTop: 4 }]}>
              {doc.customer.email}
            </Text>
          </View>

          <View style={styles.companyBlock}>
            {branding.logoDataUrl ? (
              <Image src={branding.logoDataUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.companyName}>{branding.companyName}</Text>
            {branding.addressLines.map((line, idx) => (
              <Text key={idx} style={styles.companyMeta}>{line}</Text>
            ))}
            {branding.contactEmail ? (
              <Text style={styles.companyMeta}>{branding.contactEmail}</Text>
            ) : null}
            {branding.taxId ? (
              <Text style={styles.companyMeta}>
                {t.taxIdLabel}: {branding.taxId}
              </Text>
            ) : branding.steuerNr ? (
              <Text style={styles.companyMeta}>
                {t.steuerNrLabel}: {branding.steuerNr}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{isQuote ? t.quote : t.invoice}</Text>
          <View style={styles.titleMetaRow}>
            <Text style={styles.titleMetaItem}>
              <Text style={styles.titleMetaLabel}>
                {isQuote ? t.quoteNumber : t.invoiceNumber}:
              </Text>
              {doc.number}
            </Text>
            <Text style={styles.titleMetaItem}>
              <Text style={styles.titleMetaLabel}>{t.date}:</Text>
              {fmtDate(doc.date, locale)}
            </Text>
            {isQuote && doc.validUntil ? (
              <Text style={styles.titleMetaItem}>
                <Text style={styles.titleMetaLabel}>{t.validUntil}:</Text>
                {fmtDate(doc.validUntil, locale)}
              </Text>
            ) : null}
            {!isQuote && doc.dueAt ? (
              <Text style={styles.titleMetaItem}>
                <Text style={styles.titleMetaLabel}>{t.dueAt}:</Text>
                {fmtDate(doc.dueAt, locale)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.accentLine, { backgroundColor: branding.accentColor }]} />
        </View>

        <Text style={styles.intro}>{isQuote ? t.quoteIntro : t.invoiceIntro}</Text>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.colPos}>{t.pos}</Text>
            <Text style={styles.colDesc}>{t.description}</Text>
            <Text style={styles.colQty}>{t.quantity}</Text>
            <Text style={styles.colUnit}>{t.unitPrice}</Text>
            {showTaxColumn ? <Text style={styles.colTax}>{t.tax}</Text> : null}
            <Text style={styles.colTotal}>{t.lineTotal}</Text>
          </View>
          {doc.items.map((item) => (
            <View key={item.position} style={styles.tableRow} wrap={false}>
              <Text style={styles.colPos}>{item.position}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{fmtQty(item.quantity, locale)}</Text>
              <Text style={styles.colUnit}>{fmtMoney(item.unitPriceCents, locale)}</Text>
              {showTaxColumn ? (
                <Text style={styles.colTax}>{item.taxRatePercent}%</Text>
              ) : null}
              <Text style={styles.colTotal}>{fmtMoney(item.lineCents, locale)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          {showTaxColumn ? (
            <>
              <View style={styles.totalsRow}>
                <Text>{t.net}</Text>
                <Text>{fmtMoney(doc.netCents, locale)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>{t.taxTotal}</Text>
                <Text>{fmtMoney(doc.taxCents, locale)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalsGrand}>
            <Text>{t.grandTotal}</Text>
            <Text>{fmtMoney(doc.totalCents, locale)}</Text>
          </View>
        </View>

        {branding.kleinunternehmer ? (
          <Text style={styles.kleinunternehmerNote}>{t.kleinunternehmerHint}</Text>
        ) : null}

        {/* Notes */}
        {doc.notes ? (
          <View style={styles.notesBlock} wrap={false}>
            <Text style={styles.notesLabel}>{t.notes}</Text>
            <Text>{doc.notes}</Text>
          </View>
        ) : null}

        {doc.rejectionReason ? (
          <View style={styles.notesBlock} wrap={false}>
            <Text style={styles.notesLabel}>{t.rejection}</Text>
            <Text>{doc.rejectionReason}</Text>
          </View>
        ) : null}

        {/* Bank + QR */}
        {!isQuote && (branding.bank.iban || doc.sepaQrDataUrl) ? (
          <View style={styles.bankBlock} wrap={false}>
            <View style={styles.bankInfo}>
              <Text style={styles.bankLabel}>{t.bank}</Text>
              {branding.bank.name ? <Text>{branding.bank.name}</Text> : null}
              {branding.bank.iban ? (
                <Text>
                  {t.iban}: {branding.bank.iban}
                </Text>
              ) : null}
              {branding.bank.bic ? (
                <Text>
                  {t.bic}: {branding.bank.bic}
                </Text>
              ) : null}
              <Text style={{ marginTop: 6, color: "#6b7280" }}>{t.paymentNote}</Text>
            </View>
            {doc.sepaQrDataUrl ? (
              <Image src={doc.sepaQrDataUrl} style={styles.qr} />
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View fixed style={styles.footer}>
          <Text>{branding.footer}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${t.page} ${pageNumber} ${t.of} ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
