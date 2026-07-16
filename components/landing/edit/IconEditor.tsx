"use client";

// Click the icon → pick a symbol and a tone, right there on the page.
//
// The tones are shades of the one brand accent, never free colours: DESIGN.md
// forbids a second brand colour, and a colour well here would also break
// white-labelling — icons would keep the old brand after Settings → Marke
// changed. See ICON_TONES in lib/landing/blocks.ts.

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FEATURE_ICON_NAMES,
  ICON_TONES,
  type FeatureIconName,
  type IconTone,
} from "@/lib/landing/blocks";
import { BLOCK_ICONS } from "@/components/landing/blocks/icons";
import { iconToneStyle } from "@/components/landing/blocks/section";
import { useBlockData, useLandingEdit } from "./LandingEditProvider";

export function IconEditor({ blockId, index }: { blockId: string; index: number }) {
  const edit = useLandingEdit();
  // Reactive: this component draws the icon itself, so a pick shows instantly
  // and needs no server round-trip (update below passes reload: false).
  const data = useBlockData(blockId);
  if (!edit) return null;

  const item = ((data.items as Record<string, unknown>[]) ?? [])[index] ?? {};
  const icon = (item.icon ?? "Zap") as FeatureIconName;
  const tone = (item.tone ?? "accent") as IconTone;
  const Icon = BLOCK_ICONS[icon];

  function patch(patchItem: { icon?: FeatureIconName; tone?: IconTone }) {
    const current = edit!.data(blockId);
    const items = [...((current.items as Record<string, unknown>[]) ?? [])];
    if (!items[index]) return;
    items[index] = { ...items[index], ...patchItem };
    edit!.update(blockId, { ...current, items }, false);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={edit.labels.editIcon}
          title={edit.labels.editIcon}
          data-landing-icon-edit=""
          className="landing-edit-target w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ backgroundColor: iconToneStyle(tone).tile }}
        >
          <Icon className="h-6 w-6" style={{ color: iconToneStyle(tone).color }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{edit.labels.symbol}</p>
        <div className="mb-4 grid grid-cols-6 gap-1">
          {FEATURE_ICON_NAMES.map((name) => {
            const Candidate = BLOCK_ICONS[name];
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                title={name}
                onClick={() => patch({ icon: name })}
                className={`flex h-8 w-8 items-center justify-center rounded hover:bg-muted ${
                  name === icon ? "bg-muted ring-1 ring-primary" : ""
                }`}
              >
                <Candidate className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium text-muted-foreground">{edit.labels.tone}</p>
        <div className="flex gap-1.5">
          {ICON_TONES.map((t) => {
            const style = iconToneStyle(t);
            return (
              <button
                key={t}
                type="button"
                aria-label={edit.labels[`tone_${t}`] ?? t}
                title={edit.labels[`tone_${t}`] ?? t}
                onClick={() => patch({ tone: t })}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                  t === tone ? "ring-2 ring-primary" : ""
                }`}
                style={{ backgroundColor: style.tile }}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{edit.labels.toneHint}</p>
      </PopoverContent>
    </Popover>
  );
}
