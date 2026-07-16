import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import { sectionBackground, tone, type BlockProps } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";
import { ImageEditor } from "@/components/landing/edit/ImageEditor";
import { WidthEditor } from "@/components/landing/edit/WidthEditor";

export interface ImageData {
  background: Background;
  image: string;
  alt: Localized;
  caption: Localized;
  width: "narrow" | "wide" | "full";
}

const WIDTHS: Record<ImageData["width"], string> = {
  narrow: "max-w-2xl",
  wide: "max-w-4xl",
  full: "max-w-none",
};

export function ImageBlock({ data, locale, blockId, editing }: BlockProps<ImageData>) {
  // An image block without an image is a half-finished edit, not a layout — but
  // in the editor it must stay visible, or it could never be finished from here.
  if (!data.image && !editing) return null;

  const bg = sectionBackground(data.background);
  const t = tone(data.background);
  const caption = pick(data.caption, locale);

  const picture = data.image ? (
    // Plain <img>: next/image would need width/height we do not store, and these
    // are already right-sized uploads served from our own origin.
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
      {editing && <BlockToolbar blockId={blockId} type="image" />}
      <div className="container mx-auto px-6">
        <figure className={`mx-auto ${WIDTHS[data.width]}`}>
          {editing ? (
            <ImageEditor blockId={blockId} field="image" altField="alt">
              {picture}
            </ImageEditor>
          ) : (
            picture
          )}
          {(caption || editing) && (
            <figcaption className={`mt-4 text-center text-sm ${t.body}`} style={t.bodyStyle}>
              <Editable editing={editing} blockId={blockId} field="caption">
                {caption}
              </Editable>
              {editing && <WidthEditor blockId={blockId} />}
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}
