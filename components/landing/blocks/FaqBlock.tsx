import { ChevronDown } from "lucide-react";
import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { ItemToolbar, AddItemTile } from "@/components/landing/edit/ItemToolbar";

export interface FaqData {
  background: Background;
  label: Localized;
  headline: Localized;
  items: { question: Localized; answer: Localized }[];
}

export function FaqBlock({ data, locale, blockId, editing }: BlockProps<FaqData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const label = pick(data.label, locale);
  const headline = pick(data.headline, locale);

  // Index against the original array so an empty question does not shift the
  // edit paths of the ones after it.
  const items = data.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => editing || pick(item.question, locale));

  if (items.length === 0 && !editing) return null;

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="faq" />}
      <div className="container mx-auto px-6">
        {(label || headline || editing) && (
          <div className="text-center mb-16">
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

        <div className="max-w-2xl mx-auto space-y-3">
          {items.map(({ item, index }) => (
            // <details> rather than the shadcn Accordion: it keeps the block a
            // server component with no JS, and does not pull admin tokens onto
            // the landing surface (DESIGN.md). Open while editing, so both the
            // question and its answer are reachable.
            <details
              key={index}
              open={editing}
              className={`group relative rounded-xl border ${t.cardBorder} px-6 py-4 [&_summary::-webkit-details-marker]:hidden`}
            >
              {editing && (
                <ItemToolbar blockId={blockId} index={index} min={1} />
              )}
              <summary
                className={`flex cursor-pointer items-center justify-between gap-4 font-semibold ${t.title}`}
              >
                <Editable editing={editing} blockId={blockId} field="items.question" index={index}>
                  {pick(item.question, locale)}
                </Editable>
                <ChevronDown
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  style={{ color: "var(--landing-accent)" }}
                />
              </summary>
              <p className={`mt-3 text-sm leading-relaxed ${t.body}`} style={t.bodyStyle}>
                <Editable editing={editing} blockId={blockId} field="items.answer" index={index}>
                  {pick(item.answer, locale)}
                </Editable>
              </p>
            </details>
          ))}
          {editing && (
            <AddItemTile blockId={blockId} blockType="faq" max={20} className="w-full rounded-xl px-6 py-4" />
          )}
        </div>
      </div>
    </section>
  );
}
