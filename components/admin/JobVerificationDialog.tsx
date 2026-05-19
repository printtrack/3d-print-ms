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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
    order: { id: string; customerName: string };
    files: PartFile[];
  };
}

interface JobVerificationDialogProps {
  job: PrintJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (updatedJob: PrintJob) => void;
}

type VerificationResult = "success" | "misprint";

function getPreviewFile(files: PartFile[]): PartFile | undefined {
  // Prefer STL for 3D preview, then images
  return (
    files.find((f) => /\.(stl|3mf|obj)$/i.test(f.originalName)) ??
    files.find((f) => f.mimeType.startsWith("image/"))
  );
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
  const [results, setResults] = useState<Record<string, VerificationResult>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setResults({});
    fetch(`/api/admin/jobs/${job.id}`)
      .then((r) => r.json())
      .then((data) => {
        setParts(data.parts ?? []);
      })
      .catch(() => toast.error(t("verify_dialog_load_failed")))
      .finally(() => setLoading(false));
  }, [open, job.id]);

  const allDecided = parts.length > 0 && parts.every((p) => results[p.orderPartId] !== undefined);

  async function handleSubmit() {
    if (!allDecided) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/verify-parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: Object.entries(results).map(([orderPartId, result]) => ({ orderPartId, result })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler");
      }
      toast.success(t("verify_dialog_done"));
      // Construct a minimal updated job to remove it from the board
      onVerified({ ...job, status: "DONE" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const successCount = Object.values(results).filter((r) => r === "success").length;
  const misprintCount = Object.values(results).filter((r) => r === "misprint").length;

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
          <p className="text-sm text-muted-foreground">
            {t("verify_dialog_desc")}
          </p>
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
              const result = results[jp.orderPartId];
              const previewFile = getPreviewFile(part.files);
              const is3d = previewFile && /\.(stl|3mf|obj)$/i.test(previewFile.originalName);
              const isImage = previewFile && previewFile.mimeType.startsWith("image/");
              const previewUrl = previewFile
                ? `/api/files/${previewFile.orderId}/${previewFile.filename}`
                : null;

              return (
                <div
                  key={jp.orderPartId}
                  className={cn(
                    "rounded-lg border p-4 space-y-3 transition-colors",
                    result === "success" && "border-green-400 bg-green-50/50",
                    result === "misprint" && "border-red-400 bg-red-50/50",
                    !result && "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{part.name}</p>
                      <p className="text-xs text-muted-foreground">{part.order.customerName}</p>
                      {part.quantity > 1 && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          ×{part.quantity}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        data-tutorial="verify-success-btn"
                        data-verified={result === "success" ? "true" : undefined}
                        variant={result === "success" ? "default" : "outline"}
                        className={cn(
                          "gap-1.5",
                          result === "success" && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                        )}
                        onClick={() =>
                          setResults((prev) => ({ ...prev, [jp.orderPartId]: "success" }))
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("verify_dialog_success")}
                      </Button>
                      <Button
                        size="sm"
                        variant={result === "misprint" ? "default" : "outline"}
                        className={cn(
                          "gap-1.5",
                          result === "misprint" && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                        )}
                        onClick={() =>
                          setResults((prev) => ({ ...prev, [jp.orderPartId]: "misprint" }))
                        }
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("verify_dialog_misprint")}
                      </Button>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="rounded overflow-hidden bg-muted/40 h-40">
                      {is3d ? (
                        <ModelViewer
                          url={previewUrl}
                          filename={previewFile!.originalName}
                        />
                      ) : isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={part.name}
                          className="w-full h-full object-contain"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-3 pt-2 border-t">
          <div className="mr-auto text-sm text-muted-foreground">
            {successCount > 0 && (
              <span className="text-green-700 mr-3">✓ {successCount} {t("verify_dialog_summary_ok")}</span>
            )}
            {misprintCount > 0 && (
              <span className="text-red-700">{misprintCount} {t("verify_dialog_summary_failed")}</span>
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
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {t("verify_dialog_complete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
