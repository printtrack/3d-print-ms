"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ModelViewerProps } from "@/components/ModelViewer";

const ModelViewer = dynamic<ModelViewerProps>(
  () => import("@/components/ModelViewer").then((m) => m.ModelViewer),
  { ssr: false }
);
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PrintJob } from "./JobCard";

interface PartFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  orderId: string;
}

interface PartWithFiles {
  printJobId: string;
  orderPartId: string;
  orderPart: {
    id: string;
    name: string;
    quantity: number;
    gramsEstimated: number | null;
    filament: { id: string; name: string; pricePerKg: string | null } | null;
    order: { id: string; customerName: string; isPrototype: boolean };
    files: PartFile[];
  };
}

interface IterationState {
  result: "success" | "misprint" | undefined;
  gramsActual: number;
}

interface JobVerificationDialogProps {
  job: PrintJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (updatedJob: PrintJob) => void;
}

function getPreviewFile(files: PartFile[]): PartFile | undefined {
  return (
    files.find((f) => /\.(stl|3mf|obj)$/i.test(f.originalName)) ??
    files.find((f) => f.mimeType.startsWith("image/"))
  );
}

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function computeCost(
  pricePerKg: string | null,
  gramsActual: number,
  result: "success" | "misprint" | undefined
): number | null {
  if (!pricePerKg || result === undefined) return null;
  return Math.round((gramsActual / 1000) * Number(pricePerKg) * 100);
}

export function JobVerificationDialog({
  job,
  open,
  onOpenChange,
  onVerified,
}: JobVerificationDialogProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [parts, setParts] = useState<PartWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  // iterations[orderPartId][pieceIndex]
  const [iterations, setIterations] = useState<Record<string, IterationState[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setIterations({});
    fetch(`/api/admin/jobs/${job.id}`)
      .then((r) => r.json())
      .then((data) => {
        const fetched: PartWithFiles[] = data.parts ?? [];
        setParts(fetched);
        // Initialise iteration slots
        const init: Record<string, IterationState[]> = {};
        for (const jp of fetched) {
          const qty = jp.orderPart.quantity;
          const defaultGrams = jp.orderPart.gramsEstimated != null
            ? Math.round(jp.orderPart.gramsEstimated / qty)
            : 0;
          init[jp.orderPartId] = Array.from({ length: qty }, () => ({
            result: undefined,
            gramsActual: defaultGrams,
          }));
        }
        setIterations(init);
      })
      .catch(() => toast.error(t("verify_dialog_load_failed")))
      .finally(() => setLoading(false));
  }, [open, job.id]);

  const allDecided = parts.length > 0 && parts.every((p) => {
    const slots = iterations[p.orderPartId] ?? [];
    return slots.length === p.orderPart.quantity &&
      slots.every((s) => s.result !== undefined && s.gramsActual >= 0);
  });

  function setResult(partId: string, idx: number, result: "success" | "misprint") {
    setIterations((prev) => {
      const slots = [...(prev[partId] ?? [])];
      slots[idx] = { ...slots[idx], result };
      return { ...prev, [partId]: slots };
    });
  }

  function setGrams(partId: string, idx: number, grams: number) {
    setIterations((prev) => {
      const slots = [...(prev[partId] ?? [])];
      slots[idx] = { ...slots[idx], gramsActual: grams };
      return { ...prev, [partId]: slots };
    });
  }

  function setAllSuccess(partId: string) {
    setIterations((prev) => {
      const slots = (prev[partId] ?? []).map((s) => ({ ...s, result: "success" as const }));
      return { ...prev, [partId]: slots };
    });
  }

  async function handleSubmit() {
    if (!allDecided) return;
    setSubmitting(true);
    try {
      const payload: { orderPartId: string; pieceIndex: number; result: "success" | "misprint"; gramsActual: number }[] = [];
      for (const [partId, slots] of Object.entries(iterations)) {
        for (let i = 0; i < slots.length; i++) {
          payload.push({
            orderPartId: partId,
            pieceIndex: i,
            result: slots[i].result!,
            gramsActual: slots[i].gramsActual,
          });
        }
      }

      const res = await fetch(`/api/admin/jobs/${job.id}/verify-parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iterations: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler");
      }
      toast.success(t("verify_dialog_done"));
      onVerified({ ...job, status: "DONE" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalSuccess = Object.values(iterations).flatMap((s) => s).filter((s) => s.result === "success").length;
  const totalMisprint = Object.values(iterations).flatMap((s) => s).filter((s) => s.result === "misprint").length;
  const totalGrams = Object.values(iterations).flatMap((s) => s).reduce((sum, s) => sum + s.gramsActual, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("verify_dialog_title")}
            {job.shortCode && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground border">
                {job.shortCode}
              </span>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("verify_dialog_desc")}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : parts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("verify_dialog_no_parts")}</p>
          ) : (
            parts.map((jp) => {
              const part = jp.orderPart;
              const slots = iterations[jp.orderPartId] ?? [];
              const previewFile = getPreviewFile(part.files);
              const is3d = previewFile && /\.(stl|3mf|obj)$/i.test(previewFile.originalName);
              const isImage = previewFile && previewFile.mimeType.startsWith("image/");
              const previewUrl = previewFile
                ? `/api/files/${previewFile.orderId}/${previewFile.filename}`
                : null;
              const hasPrice = part.filament?.pricePerKg != null;
              const allPartSuccess = slots.every((s) => s.result === "success");
              const anyPartDecided = slots.some((s) => s.result !== undefined);

              return (
                <div
                  key={jp.orderPartId}
                  className={cn(
                    "rounded-lg border p-4 space-y-3 transition-colors",
                    anyPartDecided && allPartSuccess && "border-green-400 bg-green-50/50",
                    anyPartDecided && !allPartSuccess && slots.every((s) => s.result !== undefined) && "border-red-400 bg-red-50/50",
                    !anyPartDecided && "border-border"
                  )}
                >
                  {/* Part header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{part.name}</p>
                      <p className="text-xs text-muted-foreground">{part.order.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {part.quantity > 1 && (
                          <Badge variant="secondary" className="text-xs">×{part.quantity}</Badge>
                        )}
                        {part.order.isPrototype && (
                          <Badge variant="outline" className="text-xs">Prototyp</Badge>
                        )}
                        {!hasPrice && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {t("inventory_no_price_warning")}
                          </span>
                        )}
                      </div>
                    </div>
                    {part.quantity > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs"
                        onClick={() => setAllSuccess(jp.orderPartId)}
                      >
                        Alle erfolgreich
                      </Button>
                    )}
                  </div>

                  {/* 3D preview */}
                  {previewUrl && (
                    <div className="rounded overflow-hidden bg-muted/40 h-40">
                      {is3d ? (
                        <ModelViewer url={previewUrl} filename={previewFile!.originalName} />
                      ) : isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt={part.name} className="w-full h-full object-contain" />
                      ) : null}
                    </div>
                  )}

                  {/* Per-piece rows */}
                  <div className="space-y-2">
                    {slots.map((slot, idx) => {
                      const costCents = hasPrice && part.filament?.pricePerKg
                        ? computeCost(part.filament.pricePerKg, slot.gramsActual, slot.result)
                        : null;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                            slot.result === "success" && "bg-green-100/60",
                            slot.result === "misprint" && "bg-red-100/60"
                          )}
                        >
                          {part.quantity > 1 && (
                            <span className="text-xs text-muted-foreground w-14 shrink-0">
                              Stück {idx + 1}
                            </span>
                          )}

                          {/* Success / Misprint buttons */}
                          <Button
                            size="sm"
                            data-tutorial={idx === 0 ? "verify-success-btn" : undefined}
                            data-verified={slot.result === "success" ? "true" : undefined}
                            variant={slot.result === "success" ? "default" : "outline"}
                            className={cn(
                              "gap-1 h-7 px-2 text-xs",
                              slot.result === "success" && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            )}
                            onClick={() => setResult(jp.orderPartId, idx, "success")}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("verify_dialog_success")}
                          </Button>
                          <Button
                            size="sm"
                            variant={slot.result === "misprint" ? "default" : "outline"}
                            className={cn(
                              "gap-1 h-7 px-2 text-xs",
                              slot.result === "misprint" && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            )}
                            onClick={() => setResult(jp.orderPartId, idx, "misprint")}
                          >
                            <XCircle className="h-3 w-3" />
                            {t("verify_dialog_misprint")}
                          </Button>

                          {/* Weight input */}
                          <div className="flex items-center gap-1 ml-auto">
                            <Input
                              type="number"
                              min="0"
                              value={slot.gramsActual}
                              onChange={(e) => setGrams(jp.orderPartId, idx, Number(e.target.value))}
                              className="h-7 w-20 text-xs text-right"
                              aria-label={`${t("verify_dialog_grams_label")} Stück ${idx + 1}`}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">g</span>
                          </div>

                          {/* Cost preview */}
                          {costCents != null && (
                            <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                              {formatEur(costCents)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-3 pt-2 border-t">
          <div className="mr-auto text-sm text-muted-foreground flex flex-wrap gap-x-3">
            {totalSuccess > 0 && (
              <span className="text-green-700">✓ {totalSuccess} {t("verify_dialog_summary_ok")}</span>
            )}
            {totalMisprint > 0 && (
              <span className="text-red-700">{totalMisprint} {t("verify_dialog_summary_failed")}</span>
            )}
            {allDecided && totalGrams > 0 && (
              <span className="text-muted-foreground">{totalGrams} g</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            data-tutorial="verify-complete-btn"
            disabled={!allDecided || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t("verify_dialog_complete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
