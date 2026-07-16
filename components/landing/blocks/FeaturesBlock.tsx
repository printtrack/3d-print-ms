import {
  pick,
  type Localized,
  type Background,
  type FeatureIconName,
  type IconTone,
} from "@/lib/landing/blocks";
import { BLOCK_ICONS } from "./icons";
import { sectionBackground, tone, iconToneStyle, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { IconEditor } from "@/components/landing/edit/IconEditor";
import { ItemToolbar, AddItemTile } from "@/components/landing/edit/ItemToolbar";

export interface FeaturesData {
  background: Background;
  label: Localized;
  headline: Localized;
  items: { icon: FeatureIconName; tone: IconTone; title: Localized; description: Localized }[];
}

// Literal class names: Tailwind scans source statically, so `lg:grid-cols-${n}`
// would never be generated. Four columns is what the default page ships.
const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function FeaturesBlock({ data, locale, blockId, editing }: BlockProps<FeaturesData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const label = pick(data.label, locale);
  const headline = pick(data.headline, locale);

  const columns = Math.min(Math.max(data.items.length, 1), 4);

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="features" />}
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

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${GRID_COLS[columns]} gap-8`}>
          {data.items.map((item, i) => {
            const Icon = BLOCK_ICONS[item.icon];
            const iconStyle = iconToneStyle(item.tone);
            return (
              <div
                key={i}
                className={`group relative p-8 rounded-2xl border ${t.cardBorder} hover:-translate-y-1 transition-transform duration-200 hover:shadow-lg`}
              >
                {editing && <ItemToolbar blockId={blockId} index={i} min={1} />}
                {editing ? (
                  <IconEditor blockId={blockId} index={i} />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: iconStyle.tile }}
                  >
                    <Icon className="h-6 w-6" style={{ color: iconStyle.color }} />
                  </div>
                )}
                <h3 className={`font-semibold ${t.title} text-lg mb-2`}>
                  <Editable editing={editing} blockId={blockId} field="items.title" index={i}>
                    {pick(item.title, locale)}
                  </Editable>
                </h3>
                <p className={`${t.body} text-sm leading-relaxed`} style={t.bodyStyle}>
                  <Editable editing={editing} blockId={blockId} field="items.description" index={i}>
                    {pick(item.description, locale)}
                  </Editable>
                </p>
              </div>
            );
          })}
          {editing && (
            <AddItemTile blockId={blockId} blockType="features" max={8} className="min-h-[13rem] p-8" />
          )}
        </div>
      </div>
    </section>
  );
}
