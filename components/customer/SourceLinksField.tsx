"use client";

import { Link2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SourceLink {
  url: string;
  label: string;
}

interface Props {
  value: SourceLink[];
  onChange: (value: SourceLink[]) => void;
}

export function SourceLinksField({ value, onChange }: Props) {
  const t = useTranslations("order_type");

  function update(index: number, patch: Partial<SourceLink>) {
    onChange(value.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function add() {
    onChange([...value, { url: "", label: "" }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          {t("source_links_label")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("source_links_hint")}</p>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((link, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2.5 sm:flex-row sm:items-center"
            >
              <Input
                type="url"
                inputMode="url"
                placeholder={t("link_url_placeholder")}
                value={link.url}
                onChange={(e) => update(i, { url: e.target.value })}
                className="flex-1 bg-background"
                aria-label={t("link_url_placeholder")}
              />
              <Input
                type="text"
                placeholder={t("link_label_placeholder")}
                value={link.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="bg-background sm:max-w-[40%]"
                aria-label={t("link_label_placeholder")}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={t("remove_link")}
                className="self-end rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:self-center"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-4 w-4" />
        {t("add_link")}
      </Button>
    </div>
  );
}
