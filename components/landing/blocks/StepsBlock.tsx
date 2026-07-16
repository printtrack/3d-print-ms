import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { ItemToolbar, AddItemTile } from "@/components/landing/edit/ItemToolbar";

export interface StepsData {
  background: Background;
  label: Localized;
  headline: Localized;
  items: { number: string; title: Localized; description: Localized }[];
}

const GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

export function StepsBlock({ data, locale, blockId, editing }: BlockProps<StepsData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const label = pick(data.label, locale);
  const headline = pick(data.headline, locale);
  const columns = Math.min(Math.max(data.items.length, 1), 6);

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="steps" />}
      <div className="container mx-auto px-6">
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

        <div className={`relative grid grid-cols-1 ${GRID_COLS[columns]} gap-12 max-w-4xl mx-auto`}>
          {/* Connecting line on desktop */}
          <div
            className="hidden md:block absolute top-10 left-[calc(100%/6)] right-[calc(100%/6)] h-px"
            style={{ backgroundColor: "var(--landing-accent-glow)" }}
          />

          {data.items.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              {editing && (
                <ItemToolbar blockId={blockId} index={i} min={1} />
              )}
              {/* The second step is the accented one — carried over from the
                  hardcoded page, where it anchored the three-step rhythm. */}
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-6 border-2 relative z-10"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  backgroundColor: i === 1 ? "var(--landing-accent)" : "white",
                  borderColor: i === 1 ? "var(--landing-accent)" : "var(--landing-accent-glow)",
                  color: i === 1 ? "var(--landing-hero-bg)" : "var(--landing-accent)",
                }}
              >
                {/* plain: the numeral is one string, not a {de,en} pair. */}
                <Editable
                  editing={editing}
                  blockId={blockId}
                  field="items.number"
                  index={i}
                  plain
                >
                  {step.number}
                </Editable>
              </div>
              <h3 className={`font-semibold ${t.title} text-lg mb-3`}>
                <Editable editing={editing} blockId={blockId} field="items.title" index={i}>
                  {pick(step.title, locale)}
                </Editable>
              </h3>
              <p className={`${t.body} text-sm leading-relaxed`} style={t.bodyStyle}>
                <Editable editing={editing} blockId={blockId} field="items.description" index={i}>
                  {pick(step.description, locale)}
                </Editable>
              </p>
            </div>
          ))}
          {editing && (
            <AddItemTile blockId={blockId} blockType="steps" max={6} className="min-h-[9rem] rounded-2xl" />
          )}
        </div>
      </div>
    </section>
  );
}
