import { DM_Serif_Display } from "next/font/google";
import { Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getSetting, getSettings } from "@/lib/settings";
import { getOrderFormConfig } from "@/lib/order-form-config";
import { buildOrderIntakeConfig, buildRegistrationMode } from "@/lib/order-intake";
import { isFeatureEnabled } from "@/lib/features";
import { getEditorLandingBlocks } from "@/lib/landing/page";
import { getPublishedLandingBlocks } from "@/lib/landing/publish";
import { BlockRenderer } from "@/components/landing/BlockRenderer";
import { BrokenBlock } from "@/components/landing/blocks/BrokenBlock";
import { LandingEditProvider } from "@/components/landing/edit/LandingEditProvider";
import { InlineText } from "@/components/landing/edit/InlineText";
import { AddBlockBar } from "@/components/landing/edit/AddBlockBar";
import { editLabels } from "@/lib/landing/edit-labels";
import { getActor, can } from "@/lib/authz";
import { isValidLocale, type Locale } from "@/i18n/locale";
import { CONTENT } from "./content";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const dynamic = "force-dynamic";

const serif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

type LT = Awaited<ReturnType<typeof getTranslations<"landing">>>;
type NT = Awaited<ReturnType<typeof getTranslations<"nav">>>;

export async function generateMetadata(): Promise<Metadata> {
  const companyName =
    (await getSetting("company_name")) ?? CONTENT.fallbackCompanyName;
  const t = await getTranslations("landing");
  return {
    title: companyName,
    description: t("hero_subheadline"),
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview_locale?: string; edit?: string }>;
}) {
  const companyName =
    (await getSetting("company_name")) ?? CONTENT.fallbackCompanyName;
  const contactEmail = (await getSetting("contact_email")) ?? "";
  const accessCodeEnabled = (await getSetting("access_code_enabled")) === "true";

  // The admin editor previews this page in an iframe and needs to see the
  // language it is currently editing, which is not the admin's own cookie
  // locale. Harmless as a public param — the page carries a DE|EN switcher.
  const { preview_locale, edit } = await searchParams;
  const cookieLocale: Locale = (await getLocale()) === "en" ? "en" : "de";
  const locale: Locale =
    preview_locale && isValidLocale(preview_locale) ? preview_locale : cookieLocale;

  // Inline editing. The query param is a request, not a grant: the permission
  // decides. Checked lazily so a normal visitor never costs an auth() call on
  // the busiest page in the app.
  const editing = edit === "1" ? can(await getActor(), "landing.edit") : false;

  const orderFormConfig = await getOrderFormConfig(locale);
  const settings = await getSettings();
  const publicIntake = buildOrderIntakeConfig(settings, "public");
  // With public intake off the form gives way to a sign-in CTA — but only if the
  // portal is actually there to point at.
  const portalEnabled = isFeatureEnabled("portal", settings);
  const registrationOpen = buildRegistrationMode(settings) === "open";
  // The editor shows the DRAFT (rows) — hidden blocks included, since you cannot
  // bring back what you cannot see, and unparseable ones as BrokenBlock, since
  // dropping them would leave an admin unable to delete a row that is broken.
  // Visitors see the PUBLISHED snapshot instead: draft edits stay private until
  // an admin publishes them.
  const blocks = editing ? await getEditorLandingBlocks() : await getPublishedLandingBlocks();
  const t = await getTranslations("landing");
  const tNav = await getTranslations("nav");

  const orderFormContext = {
    accessCodeEnabled,
    orderFormConfig,
    publicIntakeEnabled: publicIntake.enabled,
    portalEnabled,
    registrationOpen,
  };

  const page = (
    <>
      <main id="main-content">
        {blocks.map((block) => (
          <div key={block.id} className={editing && !block.visible ? "opacity-40" : undefined}>
            {"valid" in block && !block.valid ? (
              <BrokenBlock blockId={block.id} type={block.type} />
            ) : (
              <BlockRenderer
                block={block as never}
                locale={locale}
                editing={editing}
                orderFormContext={orderFormContext}
              />
            )}
          </div>
        ))}
        {editing && <AddBlockBar />}
      </main>
      <Footer companyName={companyName} contactEmail={contactEmail} t={t} tNav={tNav} />
    </>
  );

  return (
    <div className={`${serif.variable} min-h-screen`}>
      <Navbar companyName={companyName} t={t} tNav={tNav} />
      {editing ? (
        // The whole editing surface lives here, around the real page. The admin
        // route is just a frame with a language switch — see LandingEditProvider.
        <LandingEditProvider
          initialBlocks={blocks}
          locale={locale}
          labels={await editLabels()}
        >
          {page}
          <InlineText />
        </LandingEditProvider>
      ) : (
        page
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({
  companyName,
  t,
  tNav,
}: {
  companyName: string;
  t: LT;
  tNav: NT;
}) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in oklch, var(--landing-hero-bg) 80%, transparent)",
        borderColor: "oklch(1 0 0 / 8%)",
      }}
    >
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="h-5 w-5" style={{ color: "var(--landing-accent)" }} />
          <span className="text-white font-semibold text-lg">{companyName}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-white/70 hover:text-white">
            <LanguageSwitcher />
          </div>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex font-medium text-white/70 hover:text-white hover:bg-white/10"
          >
            <Link href="/portal/signin">{tNav("my_account")}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="font-semibold hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "var(--landing-accent)",
              color: "var(--landing-hero-bg)",
            }}
          >
            <a href="#order-form">{t("start_order_cta")}</a>
          </Button>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({
  companyName,
  contactEmail,
  t,
  tNav,
}: {
  companyName: string;
  contactEmail: string;
  t: LT;
  tNav: NT;
}) {
  return (
    <footer
      className="py-12 border-t"
      style={{
        backgroundColor: "var(--landing-hero-bg)",
        borderColor: "oklch(1 0 0 / 8%)",
      }}
    >
      <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Printer className="h-5 w-5" style={{ color: "var(--landing-accent)" }} />
          <div>
            <span className="text-white font-semibold">{companyName}</span>
            <p className="text-xs mt-0.5" style={{ color: "oklch(1 0 0 / 40%)" }}>
              {t("footer_tagline")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm justify-center sm:justify-end">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="landing-footer-link transition-colors"
            >
              {contactEmail}
            </a>
          )}
          <a
            href="/impressum"
            className="transition-colors"
            style={{ color: "oklch(1 0 0 / 55%)" }}
          >
            {t("imprint")}
          </a>
          <a
            href="/datenschutz"
            className="transition-colors"
            style={{ color: "oklch(1 0 0 / 55%)" }}
          >
            {t("privacy")}
          </a>
          <Link
            href="/portal/signin"
            className="transition-colors"
            style={{ color: "oklch(1 0 0 / 55%)" }}
          >
            {tNav("my_account")}
          </Link>
          <a
            href="/auth/signin"
            className="text-xs transition-colors"
            style={{ color: "oklch(1 0 0 / 40%)" }}
          >
            Admin
          </a>
        </div>
      </div>
    </footer>
  );
}
