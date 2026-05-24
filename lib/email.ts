import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { getSettings, renderTemplate } from "@/lib/settings";
import { getRecipientLocale, localeSuffix, getEmailWrappers } from "@/lib/email-locale";

// Cached Ethereal test account (created once per process)
let etherealTransport: nodemailer.Transporter | null = null;

async function getTransport(): Promise<nodemailer.Transporter | null> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host) {
    return nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: user && pass ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
    });
  }

  // Auto-create Ethereal test account for development
  if (!etherealTransport) {
    const testAccount = await nodemailer.createTestAccount();
    console.log("[email] Ethereal test account created:", testAccount.user);
    etherealTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }
  return etherealTransport;
}

async function sendMail(options: Mail.Options) {
  const transport = await getTransport();
  if (!transport) return;
  const info = await transport.sendMail(options);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("[email] Preview URL:", previewUrl);
  }
}

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

function buildHtml(companyName: string, bodyHtml: string, signature: string): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#6366f1;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:18px">${escapeHtml(companyName)}</h1>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    ${bodyHtml}
    <p style="color:#6b7280;font-size:13px;margin-top:32px">${escapeHtml(signature)}</p>
  </div>
</div>`;
}

export async function sendPhaseChangeEmail({
  customerEmail,
  customerName,
  phaseName,
  trackingToken,
}: {
  customerEmail: string;
  customerName: string;
  phaseName: string;
  trackingToken: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const vars = { customerName, phaseName, trackingUrl };

  const subject = renderTemplate(
    settings[`email_phase_subject${suffix}`] ?? settings.email_phase_subject ?? "Ihr Auftrag ist jetzt: {{phaseName}}",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_phase_body${suffix}`] ?? settings.email_phase_body ??
      "der Status Ihres 3D-Druck-Auftrags wurde aktualisiert:\nNeuer Status: {{phaseName}}",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1">${wrap.trackLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.trackLink}: ${trackingUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendOrderConfirmationEmail({
  customerEmail,
  customerName,
  trackingToken,
}: {
  customerEmail: string;
  customerName: string;
  trackingToken: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const vars = { customerName, trackingUrl };

  const subject = renderTemplate(
    settings[`email_confirm_subject${suffix}`] ?? settings.email_confirm_subject ?? "Ihr 3D-Druck-Auftrag wurde eingereicht",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_confirm_body${suffix}`] ?? settings.email_confirm_body ??
      "vielen Dank für Ihren Auftrag! Wir haben ihn erhalten und werden ihn so schnell wie möglich bearbeiten.",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1">${wrap.trackLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.trackLink}: ${trackingUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(email),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const vars = { name, resetUrl };

  const subject = renderTemplate(
    settings[`email_reset_subject${suffix}`] ?? settings.email_reset_subject ?? "Passwort zurücksetzen",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_reset_body${suffix}`] ?? settings.email_reset_body ??
      "Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\nDieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(name))}</p>
    ${bodyText.split("\n").filter((l) => l.length > 0).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${resetUrl}" style="color:#6366f1">${wrap.resetLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: email,
    subject,
    text: [wrap.greeting(name), "", bodyText, "", `${wrap.resetLink}: ${resetUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendSurveyEmail({
  customerEmail,
  customerName,
  surveyToken,
}: {
  customerEmail: string;
  customerName: string;
  surveyToken: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const surveyUrl = `${BASE_URL}/survey/${surveyToken}`;
  const vars = { customerName, surveyUrl };

  const subject = renderTemplate(
    settings[`survey_email_subject${suffix}`] ?? settings.survey_email_subject ?? "Wie war Ihr 3D-Druck-Erlebnis?",
    vars
  );
  const bodyText = renderTemplate(
    settings[`survey_email_body${suffix}`] ?? settings.survey_email_body ??
      "wir würden uns sehr über Ihr Feedback freuen. Es dauert nur 1–2 Minuten.",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${surveyUrl}" style="color:#6366f1;font-weight:bold">${wrap.surveyLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.surveyLink}: ${surveyUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendVerificationEmail({
  customerEmail,
  customerName,
  verificationToken,
  type,
  trackingToken,
  priceEstimate,
}: {
  customerEmail: string;
  customerName: string;
  verificationToken: string;
  type: "DESIGN_REVIEW" | "PRICE_APPROVAL";
  trackingToken: string;
  priceEstimate?: number;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const price = priceEstimate != null ? priceEstimate.toFixed(2) : "0.00";
  const vars = { customerName, trackingUrl, price };

  void verificationToken;

  let subject: string;
  let bodyText: string;

  if (type === "DESIGN_REVIEW") {
    subject = renderTemplate(
      settings[`email_verification_design_subject${suffix}`] ?? settings.email_verification_design_subject ?? "Designfreigabe erforderlich",
      vars
    );
    bodyText = renderTemplate(
      settings[`email_verification_design_body${suffix}`] ?? settings.email_verification_design_body ??
        "Ihre Designdateien sind bereit und warten auf Ihre Freigabe.\n\nBitte besuchen Sie Ihre Auftragsseite, um die Freigabe zu erteilen oder abzulehnen.",
      vars
    );
  } else {
    subject = renderTemplate(
      settings[`email_verification_price_subject${suffix}`] ?? settings.email_verification_price_subject ?? "Angebotsfreigabe erforderlich: {{price}} €",
      vars
    );
    bodyText = renderTemplate(
      settings[`email_verification_price_body${suffix}`] ?? settings.email_verification_price_body ??
        "Ihr Angebot in Höhe von {{price}} € wartet auf Ihre Freigabe.\n\nBitte besuchen Sie Ihre Auftragsseite, um das Angebot zu bestätigen oder abzulehnen.",
      vars
    );
  }

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1;font-weight:bold">${wrap.approvalLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.approvalLink}: ${trackingUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendCustomerPasswordResetEmail({
  email,
  name,
  resetUrl,
}: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(email),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);

  const bodyTextDe = "Sie haben eine Anfrage zum Zurücksetzen Ihres Kunden-Passworts gestellt.\nDieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.";
  const bodyTextEn = "You have requested to reset your customer account password.\nThis link is valid for 1 hour. If you did not request this, you can ignore this email.";
  const subjectDe = "Kunden-Passwort zurücksetzen";
  const subjectEn = "Reset your customer account password";

  const bodyText = locale === "en" ? bodyTextEn : bodyTextDe;
  const subject = locale === "en" ? subjectEn : subjectDe;

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(name))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${resetUrl}" style="color:#6366f1">${wrap.resetLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: email,
    subject,
    text: [wrap.greeting(name), "", bodyText, "", `${wrap.resetLink}: ${resetUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendCustomerVerificationEmail({
  email,
  name,
  verificationUrl,
}: {
  email: string;
  name: string;
  verificationUrl: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(email),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const vars = { name, verificationUrl, companyName };
  const subject = renderTemplate(
    settings[`email_customer_verify_subject${suffix}`] ?? settings.email_customer_verify_subject ?? "{{companyName}}: Konto bestätigen",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_customer_verify_body${suffix}`] ?? settings.email_customer_verify_body ??
      "Hallo {{name}},\n\nbitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.\nDieser Link ist 24 Stunden gültig.",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(name))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${verificationUrl}" style="color:#6366f1;font-weight:bold">${wrap.verifyLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: email,
    subject,
    text: [bodyText, "", `${wrap.verifyLink}: ${verificationUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendCustomerMessageEmail({
  customerEmail,
  customerName,
  trackingToken,
  messageBody,
}: {
  customerEmail: string;
  customerName: string;
  trackingToken: string;
  messageBody: string;
}) {
  const [settings, locale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const vars = { customerName, messageBody, trackingUrl, companyName };

  const subject = renderTemplate(
    settings[`email_customer_message_subject${suffix}`] ?? settings.email_customer_message_subject_de ?? "Nachricht zu deinem Auftrag bei {{companyName}}",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_customer_message_body${suffix}`] ?? settings.email_customer_message_body_de ??
      "wir haben eine Nachricht zu deinem 3D-Druck-Auftrag:\n\n{{messageBody}}\n\nDen aktuellen Status deines Auftrags kannst du jederzeit einsehen:",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<br>").join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1">${wrap.trackLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.trackLink}: ${trackingUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

export async function sendQuoteEmail({
  customerEmail,
  customerName,
  verificationToken,
  trackingToken,
  quoteId,
  quoteNumber,
  totalCents,
}: {
  customerEmail: string;
  customerName: string;
  verificationToken: string;
  trackingToken: string;
  quoteId: string;
  quoteNumber: string;
  totalCents: number;
}) {
  const [settings, rawLocale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const locale: "de" | "en" = rawLocale === "en" ? "en" : "de";
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const price = (totalCents / 100).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
    style: "currency",
    currency: "EUR",
  });
  const vars = { customerName, trackingUrl, quoteNumber, price };

  void verificationToken;

  const subject = renderTemplate(
    settings[`email_quote_subject${suffix}`] ?? settings.email_quote_subject_de ?? "Ihr Angebot {{quoteNumber}}",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_quote_body${suffix}`] ?? settings.email_quote_body_de ??
      "wir haben Ihnen ein neues Angebot erstellt. Die Details finden Sie im angehängten PDF.\n\nÜber den folgenden Link können Sie das Angebot bestätigen oder ablehnen.",
    vars
  );

  // Render PDF
  let pdfBuffer: Buffer | null = null;
  try {
    const { renderQuotePdf } = await import("@/lib/billing-render");
    const { buildBranding, quoteToDocumentData } = await import("@/lib/billing-pdf");
    const { prisma } = await import("@/lib/db");

    const fullQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: true,
        order: { select: { customerName: true, customerEmail: true } },
      },
    });
    if (fullQuote) {
      const branding = await buildBranding(settings);
      if (locale === "en" && settings.billing_footer_en) {
        branding.footer = settings.billing_footer_en;
      }
      const doc = quoteToDocumentData(
        {
          ...fullQuote,
          items: fullQuote.items.map((i) => ({
            position: i.position,
            description: i.description,
            quantity: Number(i.quantity.toString()),
            unitPriceCents: i.unitPriceCents,
            taxRatePercent: Number(i.taxRatePercent.toString()),
          })),
        },
        quoteNumber
      );
      pdfBuffer = await renderQuotePdf({ document: doc, branding, locale });
    }
  } catch (err) {
    console.error("[email] Quote PDF render failed:", err);
  }

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1;font-weight:bold">${wrap.approvalLink}</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", `${wrap.approvalLink}: ${trackingUrl}`, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
    attachments: pdfBuffer
      ? [{ filename: `${quoteNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      : undefined,
  });
}

export async function sendInvoiceEmail({
  customerEmail,
  customerName,
  invoiceId,
  invoiceNumber,
  totalCents,
  dueAt,
  pdfBuffer,
}: {
  customerEmail: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  dueAt: Date | null;
  pdfBuffer?: Buffer | null;
}) {
  void invoiceId;
  const [settings, rawLocale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const locale: "de" | "en" = rawLocale === "en" ? "en" : "de";
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);

  const price = (totalCents / 100).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
    style: "currency",
    currency: "EUR",
  });
  const dueDate = dueAt
    ? dueAt.toLocaleDateString(locale === "en" ? "en-GB" : "de-DE")
    : "";
  const vars = { customerName, invoiceNumber, price, dueDate, companyName };

  const subject = renderTemplate(
    settings[`email_invoice_subject${suffix}`] ?? settings.email_invoice_subject_de ?? "Ihre Rechnung {{invoiceNumber}}",
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_invoice_body${suffix}`] ?? settings.email_invoice_body_de ??
      "anbei erhalten Sie Ihre Rechnung {{invoiceNumber}} über {{price}}.\nZahlungsziel: {{dueDate}}.\n\nVielen Dank für Ihren Auftrag.",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<br>").join("")}`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
    attachments: pdfBuffer
      ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      : undefined,
  });
}

export async function sendPaymentReminderEmail({
  customerEmail,
  customerName,
  invoiceNumber,
  stage,
  totalCents,
  outstandingCents,
  feeCents,
  dueAt,
  pdfBuffer,
}: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  stage: 0 | 1 | 2 | 3;
  totalCents: number;
  outstandingCents: number;
  feeCents: number;
  dueAt: Date | null;
  pdfBuffer?: Buffer | null;
}) {
  const [settings, rawLocale] = await Promise.all([
    getSettings(),
    getRecipientLocale(customerEmail),
  ]);
  const locale: "de" | "en" = rawLocale === "en" ? "en" : "de";
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? (locale === "en" ? "Your 3D Print Team" : "Ihr 3D-Druck-Team");
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";
  const wrap = getEmailWrappers(locale);
  const suffix = localeSuffix(locale);
  const stageKey = stage === 0 ? "pre" : String(stage);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
      style: "currency",
      currency: "EUR",
    });

  const vars = {
    customerName,
    invoiceNumber,
    price: fmt(totalCents),
    outstanding: fmt(outstandingCents),
    fee: fmt(feeCents),
    newTotal: fmt(outstandingCents + feeCents),
    dueDate: dueAt ? dueAt.toLocaleDateString(locale === "en" ? "en-GB" : "de-DE") : "",
    companyName,
  };

  const subject = renderTemplate(
    settings[`email_payment_reminder_${stageKey}_subject${suffix}`] ??
      settings[`email_payment_reminder_${stageKey}_subject_de`] ??
      `Erinnerung: ${invoiceNumber}`,
    vars
  );
  const bodyText = renderTemplate(
    settings[`email_payment_reminder_${stageKey}_body${suffix}`] ??
      settings[`email_payment_reminder_${stageKey}_body_de`] ??
      "",
    vars
  );

  const bodyHtml = `
    <p>${escapeHtml(wrap.greeting(customerName))}</p>
    ${bodyText.split("\n").map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<br>").join("")}`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [wrap.greeting(customerName), "", bodyText, "", wrap.closing, signature].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
    attachments: pdfBuffer
      ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      : undefined,
  });
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
