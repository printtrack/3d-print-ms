// Maps a validated LandingBlock to its renderer.
//
// The data has already been through the type's zod schema in parseBlock(), which
// is what makes the casts below safe: an unparseable row never reaches here (it
// is dropped in lib/landing/page.ts), and an unknown type cannot exist because
// parseBlock rejects it.

import type { LandingBlock } from "@/lib/landing/blocks";
import type { Locale } from "@/i18n/locale";

import { HeroBlock, type HeroData } from "./blocks/HeroBlock";
import { FeaturesBlock, type FeaturesData } from "./blocks/FeaturesBlock";
import { StepsBlock, type StepsData } from "./blocks/StepsBlock";
import { OrderFormBlock, type OrderFormData, type OrderFormContext } from "./blocks/OrderFormBlock";
import { RichTextBlock, type RichTextData } from "./blocks/RichTextBlock";
import { ImageBlock, type ImageData } from "./blocks/ImageBlock";
import { TextImageBlock, type TextImageData } from "./blocks/TextImageBlock";
import { GalleryBlock, type GalleryData } from "./blocks/GalleryBlock";
import { CtaBlock, type CtaData } from "./blocks/CtaBlock";
import { FaqBlock, type FaqData } from "./blocks/FaqBlock";

export function BlockRenderer({
  block,
  locale,
  editing,
  orderFormContext,
}: {
  block: LandingBlock;
  locale: Locale;
  /** Inline editing — only ever true inside the /admin/landing preview iframe. */
  editing: boolean;
  orderFormContext: OrderFormContext;
}) {
  const common = { locale, blockId: block.id, editing };

  switch (block.type) {
    case "hero":
      return <HeroBlock {...common} data={block.data as HeroData} />;
    case "features":
      return <FeaturesBlock {...common} data={block.data as FeaturesData} />;
    case "steps":
      return <StepsBlock {...common} data={block.data as StepsData} />;
    case "order_form":
      return (
        <OrderFormBlock {...common} data={block.data as OrderFormData} context={orderFormContext} />
      );
    case "richtext":
      return <RichTextBlock {...common} data={block.data as RichTextData} />;
    case "image":
      return <ImageBlock {...common} data={block.data as ImageData} />;
    case "text_image":
      return <TextImageBlock {...common} data={block.data as TextImageData} />;
    case "gallery":
      return <GalleryBlock {...common} data={block.data as GalleryData} />;
    case "cta":
      return <CtaBlock {...common} data={block.data as CtaData} />;
    case "faq":
      return <FaqBlock {...common} data={block.data as FaqData} />;
  }
}
