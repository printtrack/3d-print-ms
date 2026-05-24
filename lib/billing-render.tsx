import { renderToBuffer } from "@react-pdf/renderer";
import { BillingDocumentPDF, type BillingBranding, type BillingDocumentData } from "@/components/billing/BillingDocumentPDF";

export async function renderQuotePdf(opts: {
  document: BillingDocumentData;
  branding: BillingBranding;
  locale: "de" | "en";
}): Promise<Buffer> {
  return renderToBuffer(
    <BillingDocumentPDF
      kind="quote"
      document={opts.document}
      branding={opts.branding}
      locale={opts.locale}
    />
  );
}

export async function renderInvoicePdf(opts: {
  document: BillingDocumentData;
  branding: BillingBranding;
  locale: "de" | "en";
}): Promise<Buffer> {
  return renderToBuffer(
    <BillingDocumentPDF
      kind="invoice"
      document={opts.document}
      branding={opts.branding}
      locale={opts.locale}
    />
  );
}
