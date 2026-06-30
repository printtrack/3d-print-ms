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
import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";

interface Props {
  onFinish: () => void;
  onRestart: () => void;
}

export function TutorialCompleteDialog({ onFinish, onRestart }: Props) {
  const t = useTranslations("tutorial");

  const achievements = [
    t("complete.achievement_kanban"),
    t("complete.achievement_detail"),
    t("complete.achievement_viewer"),
    t("complete.achievement_verification"),
    t("complete.achievement_jobs"),
    t("complete.achievement_verify"),
  ];

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 mb-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle className="text-xl">{t("complete.title")}</DialogTitle>
          <DialogDescription>{t("complete.subtitle")}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {achievements.map((a) => (
            <li key={a} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              {a}
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground text-center border-t border-border/60 pt-3">
          {t("complete.relaunch_hint")}
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onRestart} className="text-muted-foreground gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("complete.restart")}
          </Button>
          <Button
            onClick={onFinish}
            className="flex-1 sm:flex-none gap-2"
            style={{ backgroundColor: "var(--brand-accent)" }}
          >
            {t("complete.finish")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
