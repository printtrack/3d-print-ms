import { prisma } from "@/lib/db";

export async function getRecipientLocale(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { locale: true } });
  if (user) return user.locale;
  const customer = await prisma.customer.findUnique({ where: { email }, select: { locale: true } });
  return customer?.locale ?? "de";
}

export function localeSuffix(locale: string): "_de" | "_en" {
  return locale === "en" ? "_en" : "_de";
}

const EMAIL_WRAPPERS = {
  de: {
    greeting: (name: string) => `Hallo ${name},`,
    closing: "Mit freundlichen Grüßen",
    trackLink: "Auftrag verfolgen",
    resetLink: "Passwort zurücksetzen",
    surveyLink: "Jetzt Feedback geben",
    approvalLink: "Jetzt Freigabe erteilen",
    verifyLink: "E-Mail-Adresse bestätigen",
  },
  en: {
    greeting: (name: string) => `Hello ${name},`,
    closing: "Kind regards",
    trackLink: "Track order",
    resetLink: "Reset password",
    surveyLink: "Give feedback now",
    approvalLink: "Grant approval now",
    verifyLink: "Confirm email address",
  },
} as const;

export function getEmailWrappers(locale: string) {
  return EMAIL_WRAPPERS[locale === "en" ? "en" : "de"];
}
