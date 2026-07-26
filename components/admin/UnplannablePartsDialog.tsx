"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SkippedPart } from "@/lib/job-planner";

interface UnplannablePartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parts: SkippedPart[];
}

/**
 * Planning runs automatically now — this dialog is the only place where the
 * planner reports what it could NOT place, so nothing gets stuck unnoticed.
 */
export function UnplannablePartsDialog({ open, onOpenChange, parts }: UnplannablePartsDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t("unplannable_title")}
          </DialogTitle>
          <DialogDescription>{t("unplannable_description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("unplannable_empty")}</p>
          ) : (
            <div className="rounded-lg border divide-y" data-testid="unplannable-list">
              {parts.map((p) => (
                <div key={p.orderPartId} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <Link
                    href={`/admin/orders/${p.orderId}`}
                    className="font-medium hover:underline shrink-0"
                    onClick={() => onOpenChange(false)}
                  >
                    {p.partName}
                  </Link>
                  <span className="text-muted-foreground text-xs text-right">{p.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
