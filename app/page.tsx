import { DM_Serif_Display } from "next/font/google";
import { Printer, Zap, Shield, Eye, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { OrderForm } from "@/components/customer/OrderForm";
import { Button } from "@/components/ui/button";
import { getSetting } from "@/lib/settings";
import { CONTENT } from "./content";

export const dynamic = "force-dynamic";

const serif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

const FEATURE_ICONS = { Zap, Shield, Eye, MessageCircle } as const;

export async function generateMetadata(): Promise<Metadata> {
  const companyName =
    (await getSetting("company_name")) ?? CONTENT.fallbackCompanyName;
  return {
    title: companyName,
    description: CONTENT.hero.subheadline,
  };
}

export default async function Home() {
  const companyName =
    (await getSetting("company_name")) ?? CONTENT.fallbackCompanyName;
  const contactEmail = (await getSetting("contact_email")) ?? "";
  const accessCodeEnabled = (await getSetting("access_code_enabled")) === "true";

  return (
    <div className={`${serif.variable} min-h-screen`}>
      <Navbar companyName={companyName} />
      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <OrderFormSection accessCodeEnabled={accessCodeEnabled} />
      </main>
      <Footer companyName={companyName} contactEmail={contactEmail} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({ companyName }: { companyName: string }) {
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
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex font-medium text-white/70 hover:text-white hover:bg-white/10"
          >
            <Link href="/portal/signin">Mein Konto</Link>
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
            <a href="#order-form">{CONTENT.navbar.ctaLabel}</a>
          </Button>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroSection() {
  const [line1, line2] = CONTENT.hero.headline.split("\n");
  return (
    <section
      className="relative min-h-screen flex items-center pt-20"
      style={{ backgroundColor: "var(--landing-hero-bg)" }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--landing-accent) 1px, transparent 1px), linear-gradient(90deg, var(--landing-accent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Glow orb */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[420px] rounded-full blur-[140px] pointer-events-none"
        style={{ backgroundColor: "var(--landing-accent-glow)" }}
      />

      <div className="container mx-auto px-6 text-center relative z-10 animate-fade-in">
        {/* Eyebrow */}
        <p
          className="text-sm font-medium tracking-widest uppercase mb-6"
          style={{ color: "var(--landing-accent)" }}
        >
          {CONTENT.hero.eyebrow}
        </p>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1] text-white mb-8"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          {line1}
          <br />
          <span style={{ color: "var(--landing-accent)" }}>{line2}</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "oklch(1 0 0 / 60%)" }}>
          {CONTENT.hero.subheadline}
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center">
          <Button
            asChild
            size="lg"
            className="px-8 text-base font-semibold hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "var(--landing-accent)",
              color: "var(--landing-hero-bg)",
            }}
          >
            <a href="#order-form">{CONTENT.hero.primaryCta}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

function FeaturesSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p
            className="text-sm font-medium tracking-widest uppercase mb-3"
            style={{ color: "var(--landing-accent)" }}
          >
            {CONTENT.features.sectionLabel}
          </p>
          <h2
            className="text-4xl text-gray-900"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            {CONTENT.features.headline}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {CONTENT.features.items.map((item) => {
            const Icon = FEATURE_ICONS[item.icon as keyof typeof FEATURE_ICONS];
            return (
              <div
                key={item.title}
                className="group p-8 rounded-2xl border border-gray-100 hover:-translate-y-1 transition-transform duration-200 hover:shadow-lg"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: "var(--landing-accent-glow)" }}
                >
                  <Icon className="h-6 w-6" style={{ color: "var(--landing-accent)" }} />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------------

function HowItWorksSection() {
  return (
    <section className="py-24" style={{ backgroundColor: "oklch(0.97 0.004 240)" }}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p
            className="text-sm font-medium tracking-widest uppercase mb-3"
            style={{ color: "var(--landing-accent)" }}
          >
            {CONTENT.howItWorks.sectionLabel}
          </p>
          <h2
            className="text-4xl text-gray-900"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            {CONTENT.howItWorks.headline}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
          {/* Connecting line on desktop */}
          <div
            className="hidden md:block absolute top-10 left-[calc(100%/6)] right-[calc(100%/6)] h-px"
            style={{ backgroundColor: "var(--landing-accent-glow)" }}
          />

          {CONTENT.howItWorks.steps.map((step, i) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-6 border-2 relative z-10"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  backgroundColor: i === 1 ? "var(--landing-accent)" : "white",
                  borderColor: i === 1 ? "var(--landing-accent)" : "var(--landing-accent-glow)",
                  color: i === 1 ? "var(--landing-hero-bg)" : "var(--landing-accent)",
                }}
              >
                {step.number}
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-3">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Order Form
// ---------------------------------------------------------------------------

function OrderFormSection({ accessCodeEnabled }: { accessCodeEnabled: boolean }) {
  return (
    <section id="order-form" className="py-24 bg-white scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p
            className="text-sm font-medium tracking-widest uppercase mb-3"
            style={{ color: "var(--landing-accent)" }}
          >
            {CONTENT.orderSection.sectionLabel}
          </p>
          <h2
            className="text-4xl text-gray-900 mb-4"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            {CONTENT.orderSection.headline}
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            {CONTENT.orderSection.subheadline}
          </p>
        </div>
        <OrderForm accessCodeEnabled={accessCodeEnabled} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({
  companyName,
  contactEmail,
}: {
  companyName: string;
  contactEmail: string;
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
              {CONTENT.footer.tagline}
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
          <Link
            href="/portal/signin"
            className="transition-colors"
            style={{ color: "oklch(1 0 0 / 55%)" }}
          >
            Mein Konto
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
