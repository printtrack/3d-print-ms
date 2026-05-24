import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@3dprinting.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@3dprinting.local",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Created admin user:", admin.email);

  // Create default phases only if none exist
  const existingPhases = await prisma.orderPhase.count();
  if (existingPhases === 0) {
    const defaultPhases = [
      { name: "Eingegangen", color: "#6366f1", position: 0, isDefault: true },
      { name: "In Prüfung", color: "#f59e0b", position: 1 },
      { name: "In Bearbeitung", color: "#3b82f6", position: 2 },
      { name: "Abholbereit", color: "#10b981", position: 3 },
      { name: "Rechnung offen", color: "#a855f7", position: 4 },
      { name: "Abgeschlossen", color: "#6b7280", position: 5 },
    ];

    await prisma.orderPhase.createMany({ data: defaultPhases });
    console.log("Created default phases");
  } else {
    const invoicePending = await prisma.orderPhase.findFirst({ where: { name: "Rechnung offen" } });
    if (!invoicePending) {
      const abgeschlossen = await prisma.orderPhase.findFirst({ where: { name: "Abgeschlossen" } });
      if (abgeschlossen) {
        await prisma.orderPhase.update({
          where: { id: abgeschlossen.id },
          data: { position: abgeschlossen.position + 1 },
        });
        await prisma.orderPhase.create({
          data: { name: "Rechnung offen", color: "#a855f7", position: abgeschlossen.position },
        });
        console.log('Added "Rechnung offen" phase between "Abholbereit" and "Abgeschlossen"');
      } else {
        console.log("Phases already exist, skipping");
      }
    } else {
      console.log("Phases already exist, skipping");
    }
  }

  // Create default project phases only if none exist
  const existingProjectPhases = await prisma.projectPhase.count();
  if (existingProjectPhases === 0) {
    await prisma.projectPhase.createMany({
      data: [
        { name: "Planung", color: "#6366f1", position: 0, isDefault: true },
        { name: "Aktiv", color: "#10b981", position: 1 },
        { name: "Pausiert", color: "#f59e0b", position: 2 },
        { name: "Abgeschlossen", color: "#6b7280", position: 3 },
        { name: "Archiviert", color: "#9ca3af", position: 4 },
      ],
    });
    console.log("Created default project phases");
  } else {
    console.log("Project phases already exist, skipping");
  }

  // Create/update default part phases idempotently (by name)
  const partPhaseDefs = [
    { name: "Design",      color: "#6366f1", position: 0, isDefault: true,  isPrintReady: false, isReview: false, isPrinted: false, isMisprint: false },
    { name: "Überprüfung", color: "#f59e0b", position: 1, isDefault: false, isPrintReady: false, isReview: true,  isPrinted: false, isMisprint: false },
    { name: "Druckbereit", color: "#10b981", position: 2, isDefault: false, isPrintReady: true,  isReview: false, isPrinted: false, isMisprint: false },
    { name: "Gedruckt",    color: "#3b82f6", position: 3, isDefault: false, isPrintReady: false, isReview: false, isPrinted: true,  isMisprint: false },
    { name: "Fehldruck",   color: "#ef4444", position: 4, isDefault: false, isPrintReady: false, isReview: false, isPrinted: false, isMisprint: true  },
  ];
  for (const def of partPhaseDefs) {
    const existing = await prisma.partPhase.findFirst({ where: { name: def.name } });
    if (existing) {
      await prisma.partPhase.update({
        where: { id: existing.id },
        data: { color: def.color, position: def.position, isPrintReady: def.isPrintReady, isReview: def.isReview, isPrinted: def.isPrinted, isMisprint: def.isMisprint },
      });
    } else {
      await prisma.partPhase.create({ data: def });
    }
  }
  console.log("Part phases seeded (idempotent)");

  // Seed default settings
  const defaultSettings = [
    { key: "company_name", value: "3D Print CMS" },
    { key: "company_signature", value: "Ihr 3D-Druck-Team" },
    { key: "contact_email", value: "noreply@3dprinting.local" },
    { key: "email_phase_subject", value: "Ihr Auftrag ist jetzt: {{phaseName}}" },
    {
      key: "email_phase_body",
      value:
        "der Status Ihres 3D-Druck-Auftrags wurde aktualisiert:\nNeuer Status: {{phaseName}}",
    },
    { key: "email_confirm_subject", value: "Ihr 3D-Druck-Auftrag wurde eingereicht" },
    {
      key: "email_confirm_body",
      value:
        "vielen Dank für Ihren Auftrag! Wir haben ihn erhalten und werden ihn so schnell wie möglich bearbeiten.",
    },
    { key: "email_reset_subject", value: "Passwort zurücksetzen" },
    {
      key: "email_reset_body",
      value:
        "Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\nDieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",
    },
    { key: "survey_enabled", value: "true" },
    { key: "charge_misprints", value: "false" },
    { key: "charge_prototypes", value: "false" },
    { key: "require_quote_approval", value: "true" },
    { key: "quote_approval_min_cents", value: "0" },
    // Belege / PDF-Branding
    { key: "billing_logo_url", value: "" },
    { key: "billing_company_name", value: "" },
    { key: "billing_company_address_line1", value: "" },
    { key: "billing_company_address_line2", value: "" },
    { key: "billing_company_city", value: "" },
    { key: "billing_company_country", value: "Deutschland" },
    { key: "billing_tax_id", value: "" },
    { key: "billing_steuer_nr", value: "" },
    { key: "billing_default_tax_rate", value: "19" },
    { key: "billing_bank_name", value: "" },
    { key: "billing_iban", value: "" },
    { key: "billing_bic", value: "" },
    { key: "billing_kleinunternehmer", value: "false" },
    { key: "billing_footer_de", value: "" },
    { key: "billing_footer_en", value: "" },
    { key: "billing_accent_color", value: "#d97706" },
    { key: "quote_number_prefix", value: "ANG-" },
    { key: "quote_number_next", value: "1" },
    { key: "invoice_number_prefix", value: "RG-{YYYY}-" },
    { key: "payment_term_days", value: "14" },
    { key: "email_invoice_subject_de", value: "Ihre Rechnung {{invoiceNumber}}" },
    {
      key: "email_invoice_body_de",
      value:
        "anbei erhalten Sie Ihre Rechnung {{invoiceNumber}} über {{price}}.\nZahlungsziel: {{dueDate}}.\n\nVielen Dank für Ihren Auftrag.",
    },
    { key: "email_invoice_subject_en", value: "Your invoice {{invoiceNumber}}" },
    {
      key: "email_invoice_body_en",
      value:
        "please find attached your invoice {{invoiceNumber}} for {{price}}.\nDue date: {{dueDate}}.\n\nThank you for your order.",
    },
    // Mahnwesen
    { key: "payment_reminders_enabled", value: "true" },
    { key: "payment_reminder_days_before", value: "3" },
    { key: "payment_reminder_days_after_1", value: "7" },
    { key: "payment_reminder_days_after_2", value: "21" },
    { key: "payment_reminder_days_after_3", value: "42" },
    { key: "payment_reminder_fee_2_cents", value: "500" },
    { key: "payment_reminder_fee_3_cents", value: "1000" },
    {
      key: "email_payment_reminder_pre_subject_de",
      value: "Erinnerung: Rechnung {{invoiceNumber}} wird bald fällig",
    },
    {
      key: "email_payment_reminder_pre_body_de",
      value:
        "wir möchten Sie freundlich daran erinnern, dass Ihre Rechnung {{invoiceNumber}} über {{price}} am {{dueDate}} fällig wird.\n\nFalls Sie bereits bezahlt haben, ignorieren Sie diese E-Mail bitte.",
    },
    {
      key: "email_payment_reminder_1_subject_de",
      value: "Zahlungserinnerung: Rechnung {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_1_body_de",
      value:
        "die Zahlung Ihrer Rechnung {{invoiceNumber}} über {{price}} (fällig am {{dueDate}}) ist noch nicht bei uns eingegangen.\n\nBitte überweisen Sie den offenen Betrag von {{outstanding}} zeitnah.",
    },
    {
      key: "email_payment_reminder_2_subject_de",
      value: "1. Mahnung: Rechnung {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_2_body_de",
      value:
        "trotz unserer Erinnerung ist die Zahlung Ihrer Rechnung {{invoiceNumber}} über {{price}} noch immer offen.\n\nWir berechnen für diese Mahnung eine Bearbeitungsgebühr von {{fee}}. Der Gesamtbetrag beläuft sich nun auf {{newTotal}}.\n\nBitte überweisen Sie den offenen Betrag innerhalb der nächsten 7 Tage.",
    },
    {
      key: "email_payment_reminder_3_subject_de",
      value: "2. Mahnung: Rechnung {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_3_body_de",
      value:
        "wir haben Sie bereits mehrfach an die Begleichung der Rechnung {{invoiceNumber}} erinnert. Bis heute ist kein Zahlungseingang erfolgt.\n\nFür diese 2. Mahnung berechnen wir eine zusätzliche Mahngebühr von {{fee}}. Der jetzt zu zahlende Gesamtbetrag beträgt {{newTotal}}.\n\nSollte die Zahlung nicht innerhalb der nächsten 7 Tage eingehen, sehen wir uns gezwungen, weitere Schritte einzuleiten.",
    },
    {
      key: "email_payment_reminder_pre_subject_en",
      value: "Reminder: Invoice {{invoiceNumber}} due soon",
    },
    {
      key: "email_payment_reminder_pre_body_en",
      value:
        "this is a friendly reminder that your invoice {{invoiceNumber}} for {{price}} is due on {{dueDate}}.\n\nIf you have already paid, please disregard this email.",
    },
    {
      key: "email_payment_reminder_1_subject_en",
      value: "Payment reminder: Invoice {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_1_body_en",
      value:
        "we have not yet received your payment for invoice {{invoiceNumber}} for {{price}} (due on {{dueDate}}).\n\nPlease transfer the outstanding amount of {{outstanding}} at your earliest convenience.",
    },
    {
      key: "email_payment_reminder_2_subject_en",
      value: "1st payment reminder: Invoice {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_2_body_en",
      value:
        "despite our earlier reminder, payment for invoice {{invoiceNumber}} for {{price}} is still outstanding.\n\nWe are charging a reminder fee of {{fee}} for this notice. The new total amount is {{newTotal}}.\n\nPlease transfer the outstanding amount within the next 7 days.",
    },
    {
      key: "email_payment_reminder_3_subject_en",
      value: "2nd payment reminder: Invoice {{invoiceNumber}}",
    },
    {
      key: "email_payment_reminder_3_body_en",
      value:
        "we have reminded you several times to settle invoice {{invoiceNumber}}. To date, no payment has been received.\n\nFor this 2nd reminder we are charging an additional fee of {{fee}}. The new total now due is {{newTotal}}.\n\nIf payment is not received within the next 7 days, we will be forced to escalate.",
    },
    { key: "email_quote_subject_de", value: "Ihr Angebot {{quoteNumber}}" },
    {
      key: "email_quote_body_de",
      value:
        "wir haben Ihnen ein neues Angebot erstellt. Die Details finden Sie im angehängten PDF.\n\nÜber den folgenden Link können Sie das Angebot bestätigen oder ablehnen.",
    },
    { key: "email_quote_subject_en", value: "Your quote {{quoteNumber}}" },
    {
      key: "email_quote_body_en",
      value:
        "we have prepared a new quote for you. The details are in the attached PDF.\n\nUse the link below to approve or reject the quote.",
    },
    {
      key: "survey_questions",
      value: JSON.stringify([
        "Wie zufrieden waren Sie mit der Qualität?",
        "Wie würden Sie die Kommunikation bewerten?",
        "Würden Sie uns weiterempfehlen?",
      ]),
    },
    { key: "survey_email_subject", value: "Wie war Ihr 3D-Druck-Erlebnis?" },
    {
      key: "survey_email_body",
      value: "wir würden uns sehr über Ihr Feedback freuen. Es dauert nur 1–2 Minuten.",
    },
    // English email template variants
    { key: "email_phase_subject_en", value: "Your order status: {{phaseName}}" },
    {
      key: "email_phase_body_en",
      value: "the status of your 3D print order has been updated:\nNew status: {{phaseName}}",
    },
    { key: "email_confirm_subject_en", value: "Your 3D print order has been submitted" },
    {
      key: "email_confirm_body_en",
      value:
        "thank you for your order! We have received it and will process it as soon as possible.",
    },
    { key: "email_reset_subject_en", value: "Reset your password" },
    {
      key: "email_reset_body_en",
      value:
        "You have requested to reset your password.\n\nThis link is valid for 1 hour. If you did not request this, you can ignore this email.",
    },
    { key: "survey_email_subject_en", value: "How was your 3D printing experience?" },
    {
      key: "survey_email_body_en",
      value: "we would love to hear your feedback. It only takes 1–2 minutes.",
    },
    {
      key: "email_verification_design_subject_en",
      value: "Design approval required",
    },
    {
      key: "email_verification_design_body_en",
      value:
        "Your design files are ready and waiting for your approval.\n\nPlease visit your order page to approve or reject them.",
    },
    {
      key: "email_verification_price_subject_en",
      value: "Quote approval required: {{price}} €",
    },
    {
      key: "email_verification_price_body_en",
      value:
        "Your quote of {{price}} € is waiting for your approval.\n\nPlease visit your order page to confirm or reject the quote.",
    },
    {
      key: "email_customer_verify_subject_en",
      value: "{{companyName}}: Verify your account",
    },
    {
      key: "email_customer_verify_body_en",
      value:
        "Hello {{name}},\n\nplease verify your email address to activate your account.\nThis link is valid for 24 hours.",
    },
    {
      key: "email_customer_message_subject_de",
      value: "Nachricht zu deinem Auftrag bei {{companyName}}",
    },
    {
      key: "email_customer_message_body_de",
      value:
        "wir haben eine Nachricht zu deinem 3D-Druck-Auftrag:\n\n{{messageBody}}\n\nDen aktuellen Status deines Auftrags kannst du jederzeit einsehen:",
    },
    {
      key: "email_customer_message_subject_en",
      value: "Message regarding your order at {{companyName}}",
    },
    {
      key: "email_customer_message_body_en",
      value:
        "we have a message regarding your 3D print order:\n\n{{messageBody}}\n\nYou can check the current status of your order at any time:",
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log("Default settings seeded");

  // Seed sample filaments
  const existingFilaments = await prisma.filament.count();
  if (existingFilaments === 0) {
    await prisma.filament.createMany({
      data: [
        {
          name: "PLA Basic Weiß",
          material: "PLA",
          color: "Weiß",
          colorHex: "#FFFFFF",
          brand: "Prusament",
          spoolWeightGrams: 1000,
          remainingGrams: 750,
          isActive: true,
        },
        {
          name: "PETG Transparent Blau",
          material: "PETG",
          color: "Transparent Blau",
          colorHex: "#60a5fa",
          brand: "Polymaker",
          spoolWeightGrams: 1000,
          remainingGrams: 200,
          notes: "Wenig Bestand – nachbestellen",
          isActive: true,
        },
        {
          name: "TPU Flexibel Schwarz",
          material: "TPU",
          color: "Schwarz",
          colorHex: "#1a1a1a",
          brand: "eSUN",
          spoolWeightGrams: 500,
          remainingGrams: 480,
          isActive: true,
        },
      ],
    });
    console.log("Sample filaments seeded");
  } else {
    console.log("Filaments already exist, skipping");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
