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
      { name: "Abgeschlossen", color: "#6b7280", position: 4 },
    ];

    await prisma.orderPhase.createMany({ data: defaultPhases });
    console.log("Created default phases");
  } else {
    console.log("Phases already exist, skipping");
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
