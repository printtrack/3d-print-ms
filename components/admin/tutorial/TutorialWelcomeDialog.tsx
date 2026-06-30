"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, Package } from "lucide-react";

interface Props {
  onStart: () => void;
  onSkip: () => void;
}

export function TutorialWelcomeDialog({ onStart, onSkip }: Props) {
  const t = useTranslations("tutorial");

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl mb-3"
            style={{
              background: "linear-gradient(135deg, color-mix(in oklab, var(--brand-accent) 15%, transparent) 0%, color-mix(in oklab, var(--brand-accent-dim) 8%, transparent) 100%)",
              border: "1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)",
            }}
          >
            <Sparkles className="h-6 w-6" style={{ color: "var(--brand-accent-dim)" }} />
          </div>
          <DialogTitle className="text-xl">{t("welcome.title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("welcome.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Story card */}
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            background: "color-mix(in oklab, var(--brand-accent) 6%, transparent)",
            border: "1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)",
          }}
        >
          <p className="font-medium mb-2 text-foreground">{t("welcome.story_label")}</p>
          <p className="text-muted-foreground italic leading-relaxed">{t("welcome.story")}</p>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {t("welcome.story_quantity")}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {t("welcome.story_deadline")}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("welcome.no_data_saved")}
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            {t("welcome.skip")}
          </Button>
          <Button
            onClick={onStart}
            className="flex-1 sm:flex-none"
            style={{ backgroundColor: "var(--brand-accent)" }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t("welcome.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
