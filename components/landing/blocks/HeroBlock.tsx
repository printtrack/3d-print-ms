import { Button } from "@/components/ui/button";
import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { LinkEditor } from "@/components/landing/edit/LinkEditor";

export interface HeroData {
  background: Background;
  eyebrow: Localized;
  headline1: Localized;
  headline2: Localized;
  subheadline: Localized;
  ctaLabel: Localized;
  ctaHref: string;
}

export function HeroBlock({ data, locale, blockId, editing }: BlockProps<HeroData>) {
  const bg = sectionBackground(data.background);
  const eyebrow = pick(data.eyebrow, locale);
  const headline1 = pick(data.headline1, locale);
  const headline2 = pick(data.headline2, locale);
  const subheadline = pick(data.subheadline, locale);
  const ctaLabel = pick(data.ctaLabel, locale);

  return (
    <section
      data-landing-block={blockId}
      className={`relative min-h-screen flex items-center pt-20 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="hero" />}
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
        {/* `|| editing` throughout: an empty field renders nothing on the public
            page, but in the editor it has to stay clickable — otherwise a field
            you once cleared can never be filled in again from here. */}
        {(eyebrow || editing) && (
          <p
            className="text-sm font-medium tracking-widest uppercase mb-6"
            style={{ color: "var(--landing-accent)" }}
          >
            <Editable editing={editing} blockId={blockId} field="eyebrow">
              {eyebrow}
            </Editable>
          </p>
        )}

        <h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1] text-white mb-8"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          <Editable editing={editing} blockId={blockId} field="headline1">
            {headline1}
          </Editable>
          {(headline2 || editing) && (
            <>
              <br />
              <span style={{ color: "var(--landing-accent)" }}>
                <Editable editing={editing} blockId={blockId} field="headline2">
                  {headline2}
                </Editable>
              </span>
            </>
          )}
        </h1>

        {(subheadline || editing) && (
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "oklch(1 0 0 / 60%)" }}
          >
            <Editable editing={editing} blockId={blockId} field="subheadline">
              {subheadline}
            </Editable>
          </p>
        )}

        {(ctaLabel || editing) && (
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
              <a href={data.ctaHref || "#order-form"}>
                <Editable editing={editing} blockId={blockId} field="ctaLabel">
                  {ctaLabel}
                </Editable>
              </a>
            </Button>
            {/* The label is visible text and edited in place; where the button
                goes is not, so it gets a pencil of its own. */}
            {editing && <LinkEditor blockId={blockId} field="ctaHref" />}
          </div>
        )}
      </div>
    </section>
  );
}
