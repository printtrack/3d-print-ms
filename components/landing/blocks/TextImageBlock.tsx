import { Button } from "@/components/ui/button";
import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { LandingMarkdown } from "./LandingMarkdown";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { ImageEditor } from "@/components/landing/edit/ImageEditor";
import { LinkEditor } from "@/components/landing/edit/LinkEditor";
import { MarkdownEditor } from "@/components/landing/edit/MarkdownEditor";
import { ImageSideEditor } from "@/components/landing/edit/WidthEditor";

export interface TextImageData {
  background: Background;
  headline: Localized;
  body: Localized;
  image: string;
  alt: Localized;
  imageSide: "left" | "right";
  ctaLabel: Localized;
  ctaHref: string;
}

export function TextImageBlock({ data, locale, blockId, editing }: BlockProps<TextImageData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const headline = pick(data.headline, locale);
  const body = pick(data.body, locale);
  const ctaLabel = pick(data.ctaLabel, locale);

  const picture = data.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.image}
      alt={pick(data.alt, locale)}
      className="w-full h-auto rounded-2xl"
      loading="lazy"
    />
  ) : (
    <div
      className={`flex h-48 items-center justify-center rounded-2xl border border-dashed ${t.body}`}
      style={t.bodyStyle}
    >
      …
    </div>
  );

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="text_image" />}
      {editing && <ImageSideEditor blockId={blockId} />}
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div className={data.imageSide === "left" ? "md:order-2" : ""}>
            {(headline || editing) && (
              <h2
                className={`text-4xl mb-6 ${t.headline}`}
                style={{ fontFamily: "var(--font-dm-serif)" }}
              >
                <Editable editing={editing} blockId={blockId} field="headline">
                  {headline}
                </Editable>
              </h2>
            )}
            {/* Markdown source in a popover — see RichTextBlock. */}
            {editing ? (
              <MarkdownEditor blockId={blockId} field="body">
                {body ? (
                  <LandingMarkdown dark={t.dark}>{body}</LandingMarkdown>
                ) : (
                  <div
                    className={`rounded-lg border border-dashed py-8 text-center ${t.body}`}
                    style={t.bodyStyle}
                  >
                    …
                  </div>
                )}
              </MarkdownEditor>
            ) : (
              body && <LandingMarkdown dark={t.dark}>{body}</LandingMarkdown>
            )}
            {(ctaLabel || editing) && (
              <div className="mt-6 flex items-center">
                {(ctaLabel || editing) && (
                  <Button
                    asChild
                    className="font-semibold hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: "var(--landing-accent)",
                      color: "var(--landing-hero-bg)",
                    }}
                  >
                    <a href={data.ctaHref || "#"}>
                      <Editable editing={editing} blockId={blockId} field="ctaLabel">
                        {ctaLabel}
                      </Editable>
                    </a>
                  </Button>
                )}
                {editing && <LinkEditor blockId={blockId} field="ctaHref" />}
              </div>
            )}
          </div>
          {/* Without an image the text takes the full width rather than leaving a
              hole — but in edit mode the slot stays, or an image could never be
              added back. */}
          {(data.image || editing) && (
            <div className={data.imageSide === "left" ? "md:order-1" : ""}>
              {editing ? (
                <ImageEditor blockId={blockId} field="image" altField="alt">
                  {picture}
                </ImageEditor>
              ) : (
                picture
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
