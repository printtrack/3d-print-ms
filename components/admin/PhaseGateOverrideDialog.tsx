"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EvaluatedReason } from "@/lib/phase-conditions";

interface Props {
  open: boolean;
  reasons: EvaluatedReason[];
  targetPhaseName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function PhaseGateOverrideDialog({
  open,
  reasons,
  targetPhaseName,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit = reason.trim().length >= 5;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onCancel()}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="phase-gate-override-dialog"
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle>{t("phase_gate_blocked_title")}</DialogTitle>
              <DialogDescription className="mt-1">
                → <span className="font-medium">{targetPhaseName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("phase_gate_blocked_description")}
          </p>
          <ul
            className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            data-testid="phase-gate-reasons"
          >
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden="true">•</span>
                <span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t(r.key, (r.params ?? {}) as any)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1">
            <Label htmlFor="override-reason">{t("phase_gate_override_label")} *</Label>
            <Textarea
              id="override-reason"
              data-testid="phase-gate-override-input"
              placeholder={t("phase_gate_override_placeholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
            />
            {reason.length > 0 && reason.length < 5 && (
              <p className="text-xs text-destructive">{t("phase_gate_override_too_short")}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            data-testid="phase-gate-override-submit"
            variant="destructive"
          >
            {t("phase_gate_override_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
