import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/SessionProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { getBranding, brandAccentCss } from "@/lib/branding";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { companyName, faviconUrl } = await getBranding();
  return {
    title: companyName,
    description: "3D Print Order Management System",
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const accentCss = brandAccentCss(await getBranding());

  return (
    <html lang={locale}>
      {accentCss ? (
        <head>
          <style dangerouslySetInnerHTML={{ __html: accentCss }} />
        </head>
      ) : null}
      <body className={`${geist.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:shadow-lg focus:border focus:outline-none"
        >
          {locale === "de" ? "Zum Hauptinhalt springen" : "Skip to main content"}
        </a>
        <NextIntlClientProvider messages={messages}>
          <AuthSessionProvider>
            {children}
          </AuthSessionProvider>
        </NextIntlClientProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
