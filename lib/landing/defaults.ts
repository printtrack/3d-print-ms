// The landing page an untouched install shows.
//
// Until an admin opens the editor, the LandingBlock table is empty and the page
// renders these blocks instead — byte-for-byte the sections that used to be
// hardcoded in app/page.tsx. That keeps the update invisible for existing shops
// and keeps tests/public/visual.spec.ts green without a new baseline.
//
// The copy is read from messages/{de,en}.json (namespace `landing`), which is
// where it already lived, and materialized into *literal* {de,en} values rather
// than i18n keys — otherwise every renderer would need a second code path for
// "default" blocks. Once the editor writes real rows, these are never consulted
// again; the i18n keys stay only as the source of this seed.

import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { parseBlock, type LandingBlock, type Localized } from "./blocks";

type LandingKey = keyof typeof de.landing;

/** Pull one key from both message files into a {de, en} pair. */
function t(key: LandingKey): Localized {
  return {
    de: de.landing[key] as string,
    en: (en.landing[key] as string) ?? "",
  };
}

/**
 * Stable synthetic ids. These blocks are not DB rows, so they have no cuid, but
 * React keys and the editor's selection state need something constant.
 */
const DEFAULT_ID_PREFIX = "default-";

export function isDefaultBlockId(id: string): boolean {
  return id.startsWith(DEFAULT_ID_PREFIX);
}

/** The default page, in order: hero → features → steps → order form. */
export function buildDefaultBlocks(): LandingBlock[] {
  const raw = [
    {
      type: "hero",
      data: {
        background: "dark",
        eyebrow: t("hero_eyebrow"),
        headline1: t("hero_headline_1"),
        headline2: t("hero_headline_2"),
        subheadline: t("hero_subheadline"),
        ctaLabel: t("hero_cta"),
        ctaHref: "#order-form",
      },
    },
    {
      type: "features",
      data: {
        background: "white",
        label: t("features_label"),
        headline: t("features_headline"),
        items: [
          { icon: "Zap", title: t("feature_fast_title"), description: t("feature_fast_desc") },
          { icon: "Shield", title: t("feature_quality_title"), description: t("feature_quality_desc") },
          { icon: "Eye", title: t("feature_status_title"), description: t("feature_status_desc") },
          {
            icon: "MessageCircle",
            title: t("feature_questions_title"),
            description: t("feature_questions_desc"),
          },
        ],
      },
    },
    {
      type: "steps",
      data: {
        background: "muted",
        label: t("how_label"),
        headline: t("how_headline"),
        items: [
          { number: "01", title: t("step1_title"), description: t("step1_desc") },
          { number: "02", title: t("step2_title"), description: t("step2_desc") },
          { number: "03", title: t("step3_title"), description: t("step3_desc") },
        ],
      },
    },
    {
      type: "order_form",
      data: {
        background: "white",
        label: t("order_label"),
        headline: t("order_headline"),
        subheadline: t("order_subheadline"),
      },
    },
  ];

  return raw.map((block, position) => {
    const parsed = parseBlock({
      id: `${DEFAULT_ID_PREFIX}${block.type}`,
      type: block.type,
      position,
      visible: true,
      data: block.data,
    });
    // The defaults are ours, not user input — a mismatch here is a programming
    // error (a schema changed without this file following), not bad data.
    if (!parsed) {
      throw new Error(`Default landing block "${block.type}" does not match its schema`);
    }
    return parsed;
  });
}

/** Shape for POST /api/admin/landing/init — rows to create, without ids. */
export function defaultBlockRows(): { type: string; position: number; visible: boolean; data: unknown }[] {
  return buildDefaultBlocks().map(({ type, position, visible, data }) => ({
    type,
    position,
    visible,
    data,
  }));
}
