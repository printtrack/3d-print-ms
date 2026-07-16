import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { LandingMarkdown } from "./LandingMarkdown";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { MarkdownEditor } from "@/components/landing/edit/MarkdownEditor";

export interface RichTextData {
  background: Background;
  label: Localized;
  headline: Localized;
  body: Localized;
}

export function RichTextBlock({ data, locale, blockId, editing }: BlockProps<RichTextData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const label = pick(data.label, locale);
  const headline = pick(data.headline, locale);
  const body = pick(data.body, locale);

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="richtext" />}
      <div className="container mx-auto px-6">
        {(label || headline || editing) && (
          <div className="text-center mb-12">
            {(label || editing) && (
              <p
                className="text-sm font-medium tracking-widest uppercase mb-3"
                style={{ color: "var(--landing-accent)" }}
              >
                <Editable editing={editing} blockId={blockId} field="label">
                  {label}
                </Editable>
              </p>
            )}
            {(headline || editing) && (
              <h2 className={`text-4xl ${t.headline}`} style={{ fontFamily: "var(--font-dm-serif)" }}>
                <Editable editing={editing} blockId={blockId} field="headline">
                  {headline}
                </Editable>
              </h2>
            )}
          </div>
        )}
        {(body || editing) && (
          // Not contentEditable: typing into rendered markdown would save the
          // flattened text and destroy the formatting. MarkdownEditor opens the
          // source in a popover on the body itself.
          <div className="max-w-2xl mx-auto">
            {editing ? (
              <MarkdownEditor blockId={blockId} field="body">
                {body ? (
                  <LandingMarkdown dark={t.dark}>{body}</LandingMarkdown>
                ) : (
                  // An emptied body would otherwise have nothing to click, and
                  // could never be written again. Same "…" affordance the empty
                  // text fields use — a mark, not copy, so nothing to translate.
                  <div
                    className={`rounded-lg border border-dashed py-8 text-center ${t.body}`}
                    style={t.bodyStyle}
                  >
                    …
                  </div>
                )}
              </MarkdownEditor>
            ) : (
              <LandingMarkdown dark={t.dark}>{body}</LandingMarkdown>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
