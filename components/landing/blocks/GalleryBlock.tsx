import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { ImageEditor } from "@/components/landing/edit/ImageEditor";
import { ItemToolbar, AddItemTile } from "@/components/landing/edit/ItemToolbar";

export interface GalleryData {
  background: Background;
  label: Localized;
  headline: Localized;
  items: { image: string; alt: Localized; caption: Localized }[];
}

export function GalleryBlock({ data, locale, blockId, editing }: BlockProps<GalleryData>) {
  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const label = pick(data.label, locale);
  const headline = pick(data.headline, locale);

  // Index against the original array, not a filtered one — an entry without an
  // image must not shift the edit path of the entries after it. While editing,
  // empty entries stay so they can be filled in.
  const items = data.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => editing || item.image);

  if (items.length === 0 && !editing) return null;

  return (
    <section
      data-landing-block={blockId}
      className={`relative py-24 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="gallery" />}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map(({ item, index }) => {
              const caption = pick(item.caption, locale);
              const picture = item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={pick(item.alt, locale)}
                  className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`flex h-64 items-center justify-center border border-dashed ${t.body}`}
                  style={t.bodyStyle}
                >
                  …
                </div>
              );

              return (
                <figure key={index} className="group relative">
                  {editing && <ItemToolbar blockId={blockId} index={index} min={0} />}
                  <div className="overflow-hidden rounded-2xl">
                    {editing ? (
                      <ImageEditor
                        blockId={blockId}
                        field="items.image"
                        altField="items.alt"
                        index={index}
                      >
                        {picture}
                      </ImageEditor>
                    ) : (
                      picture
                    )}
                  </div>
                  {(caption || editing) && (
                    <figcaption className={`mt-3 text-sm ${t.body}`} style={t.bodyStyle}>
                      <Editable
                        editing={editing}
                        blockId={blockId}
                        field="items.caption"
                        index={index}
                      >
                        {caption}
                      </Editable>
                    </figcaption>
                  )}
                </figure>
              );
            })}
          {editing && (
            <AddItemTile blockId={blockId} blockType="gallery" max={12} className="h-64" />
          )}
        </div>
      </div>
    </section>
  );
}
