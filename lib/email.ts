import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { getSettings, renderTemplate } from "@/lib/settings";

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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const vars = { customerName, phaseName, trackingUrl };

  const subject = renderTemplate(
    settings.email_phase_subject ?? "Ihr Auftrag ist jetzt: {{phaseName}}",
    vars
  );
  const bodyText = renderTemplate(
    settings.email_phase_body ??
      "der Status Ihres 3D-Druck-Auftrags wurde aktualisiert:\nNeuer Status: {{phaseName}}",
    vars
  );

  const bodyHtml = `
    <p>Hallo ${escapeHtml(customerName)},</p>
    ${bodyText
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1">Auftrag verfolgen</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [
      `Hallo ${customerName},`,
      "",
      bodyText,
      "",
      `Auftrag verfolgen: ${trackingUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const vars = { customerName, trackingUrl };

  const subject = renderTemplate(
    settings.email_confirm_subject ?? "Ihr 3D-Druck-Auftrag wurde eingereicht",
    vars
  );
  const bodyText = renderTemplate(
    settings.email_confirm_body ??
      "vielen Dank für Ihren Auftrag! Wir haben ihn erhalten und werden ihn so schnell wie möglich bearbeiten.",
    vars
  );

  const bodyHtml = `
    <p>Hallo ${escapeHtml(customerName)},</p>
    ${bodyText
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1">Auftrag verfolgen</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [
      `Hallo ${customerName},`,
      "",
      bodyText,
      "",
      `Auftrag verfolgen: ${trackingUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const vars = { name, resetUrl };

  const subject = renderTemplate(
    settings.email_reset_subject ?? "Passwort zurücksetzen",
    vars
  );
  const bodyText = renderTemplate(
    settings.email_reset_body ??
      "Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\nDieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",
    vars
  );

  const bodyHtml = `
    <p>Hallo ${escapeHtml(name)},</p>
    ${bodyText
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <p><a href="${resetUrl}" style="color:#6366f1">Passwort zurücksetzen</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: email,
    subject,
    text: [
      `Hallo ${name},`,
      "",
      bodyText,
      "",
      `Passwort zurücksetzen: ${resetUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const surveyUrl = `${BASE_URL}/survey/${surveyToken}`;
  const vars = { customerName, surveyUrl };

  const subject = renderTemplate(
    settings.survey_email_subject ?? "Wie war Ihr 3D-Druck-Erlebnis?",
    vars
  );
  const bodyText = renderTemplate(
    settings.survey_email_body ??
      "wir würden uns sehr über Ihr Feedback freuen. Es dauert nur 1–2 Minuten.",
    vars
  );

  const bodyHtml = `
    <p>Hallo ${escapeHtml(customerName)},</p>
    ${bodyText
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <p><a href="${surveyUrl}" style="color:#6366f1;font-weight:bold">Jetzt Feedback geben</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [
      `Hallo ${customerName},`,
      "",
      bodyText,
      "",
      `Feedback geben: ${surveyUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const trackingUrl = `${BASE_URL}/track/${trackingToken}`;
  const price = priceEstimate != null ? priceEstimate.toFixed(2) : "0.00";
  const vars = { customerName, trackingUrl, price };

  // verificationToken kept for backwards compatibility but not used in template
  void verificationToken;

  let subject: string;
  let bodyText: string;

  if (type === "DESIGN_REVIEW") {
    subject = renderTemplate(
      settings.email_verification_design_subject ?? "Designfreigabe erforderlich",
      vars
    );
    bodyText = renderTemplate(
      settings.email_verification_design_body ??
        "Ihre Designdateien sind bereit und warten auf Ihre Freigabe.\n\nBitte besuchen Sie Ihre Auftragsseite, um die Freigabe zu erteilen oder abzulehnen.",
      vars
    );
  } else {
    subject = renderTemplate(
      settings.email_verification_price_subject ?? "Angebotsfreigabe erforderlich: {{price}} €",
      vars
    );
    bodyText = renderTemplate(
      settings.email_verification_price_body ??
        "Ihr Angebot in Höhe von {{price}} € wartet auf Ihre Freigabe.\n\nBitte besuchen Sie Ihre Auftragsseite, um das Angebot zu bestätigen oder abzulehnen.",
      vars
    );
  }

  const bodyHtml = `
    <p>Hallo ${escapeHtml(customerName)},</p>
    ${bodyText
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <p><a href="${trackingUrl}" style="color:#6366f1;font-weight:bold">Jetzt Freigabe erteilen</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: customerEmail,
    subject,
    text: [
      `Hallo ${customerName},`,
      "",
      bodyText,
      "",
      `Freigabe erteilen: ${trackingUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
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
  const settings = await getSettings();
  const companyName = settings.company_name ?? "3D Print CMS";
  const signature = settings.company_signature ?? "Ihr 3D-Druck-Team";
  const contactEmail = settings.contact_email ?? "noreply@3dprinting.local";

  const bodyHtml = `
    <p>Hallo ${escapeHtml(name)},</p>
    <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Kunden-Passworts gestellt.</p>
    <p>Dieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
    <p><a href="${resetUrl}" style="color:#6366f1">Passwort zurücksetzen</a></p>`;

  await sendMail({
    from: `${companyName} <${contactEmail}>`,
    to: email,
    subject: "Kunden-Passwort zurücksetzen",
    text: [
      `Hallo ${name},`,
      "",
      "Sie haben eine Anfrage zum Zurücksetzen Ihres Kunden-Passworts gestellt.",
      "Dieser Link ist 1 Stunde gültig.",
      "",
      `Passwort zurücksetzen: ${resetUrl}`,
      "",
      "Mit freundlichen Grüßen",
      signature,
    ].join("\n"),
    html: buildHtml(companyName, bodyHtml, signature),
  });
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
