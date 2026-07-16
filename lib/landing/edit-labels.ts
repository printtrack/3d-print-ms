// Copy for the in-page editor chrome, resolved on the server and handed to the
// client provider as a plain map.
//
// The edit components live deep inside server-rendered blocks and would each
// need their own next-intl client context otherwise. One lookup here, one prop,
// and they all read from `edit.labels` — which also keeps every string in
// messages/{de,en}.json, as CLAUDE.md requires.

import { getTranslations } from "next-intl/server";
import { BLOCK_TYPES, BACKGROUNDS, ICON_TONES } from "./blocks";

export async function editLabels(): Promise<Record<string, string>> {
  const t = await getTranslations("admin");

  const labels: Record<string, string> = {
    saveFailed: t("landing_save_failed"),
    moveUp: t("landing_move_up"),
    moveDown: t("landing_move_down"),
    background: t("landing_field_background"),
    hide: t("landing_hide"),
    show: t("landing_show"),
    addBlock: t("landing_add_block"),
    addBlockBelow: t("landing_add_block_below"),
    deleteBlock: t("landing_delete_block"),
    deleteTitle: t("landing_delete_title"),
    deleteBody: t("landing_delete_body"),
    cancel: t("landing_delete_cancel"),
    confirmDelete: t("landing_delete_confirm"),
    lockedHint: t("landing_locked_hint"),
    editIcon: t("landing_edit_icon"),
    symbol: t("landing_field_icon"),
    tone: t("landing_field_tone"),
    toneHint: t("landing_tone_hint"),
    editImage: t("landing_edit_image"),
    replaceImage: t("landing_image_upload"),
    removeImage: t("landing_image_remove"),
    imageHint: t("landing_image_hint"),
    uploading: t("landing_uploading"),
    uploadDone: t("landing_upload_done"),
    uploadFailed: t("landing_upload_failed"),
    altLabel: t("landing_field_alt"),
    altHint: t("landing_alt_hint"),
    editText: t("landing_edit_text"),
    markdownHint: t("landing_markdown_hint"),
    editLink: t("landing_edit_link"),
    linkTarget: t("landing_field_cta_href"),
    linkHint: t("landing_field_href_hint"),
    addItem: t("landing_item_add"),
    removeItem: t("landing_item_remove"),
    width: t("landing_field_width"),
  };

  for (const type of BLOCK_TYPES) labels[`block_${type}`] = t(`landing_block_${type}`);
  for (const bg of BACKGROUNDS) labels[`background_${bg}`] = t(`landing_background_${bg}`);
  for (const tone of ICON_TONES) labels[`tone_${tone}`] = t(`landing_tone_${tone}`);
  for (const w of ["narrow", "wide", "full"]) labels[`width_${w}`] = t(`landing_width_${w}`);
  for (const s of ["left", "right"]) labels[`side_${s}`] = t(`landing_side_${s}`);

  return labels;
}
