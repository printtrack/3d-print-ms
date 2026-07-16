import { Button } from "@/components/ui/button";
import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { LinkEditor } from "@/components/landing/edit/LinkEditor";

export interface CtaData {
  background: Background;
  headline: Localized;
  subheadline: Localized;
  buttonLabel: Localized;
  buttonHref: string;
}

export function CtaBlock({ data, locale, blockId, editing }: BlockProps<CtaData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const headline = pick(data.headline, locale);
  const subheadline = pick(data.subheadline, locale);
  const buttonLabel = pick(data.buttonLabel, locale);

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 overflow-hidden ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="cta" />}
      {t.dark && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: "var(--landing-accent-glow)" }}
        />
      )}
      <div className="container mx-auto px-6 text-center relative z-10">
        {(headline || editing) && (
          <h2
            className={`text-4xl mb-4 ${t.headline}`}
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            <Editable editing={editing} blockId={blockId} field="headline">
              {headline}
            </Editable>
          </h2>
        )}
        {(subheadline || editing) && (
          <p className={`text-lg max-w-xl mx-auto mb-8 ${t.body}`} style={t.bodyStyle}>
            <Editable editing={editing} blockId={blockId} field="subheadline">
              {subheadline}
            </Editable>
          </p>
        )}
        {(buttonLabel || editing) && (
          <Button
            asChild
            size="lg"
            className="px-8 text-base font-semibold hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "var(--landing-accent)",
              color: "var(--landing-hero-bg)",
            }}
          >
            <a href={data.buttonHref || "#order-form"}>
              <Editable editing={editing} blockId={blockId} field="buttonLabel">
                {buttonLabel}
              </Editable>
            </a>
          </Button>
        )}
        {editing && <LinkEditor blockId={blockId} field="buttonHref" />}
      </div>
    </section>
  );
}
