"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QuoteCustomerView } from "@/components/customer/QuoteCustomerView";
import { InvoiceCustomerView, type InvoiceCustomer } from "@/components/customer/InvoiceCustomerView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatFileSize, is3DModel } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, FileText, Image as ImageIcon, MessageSquare, Package, ShieldAlert, ShieldCheck, Star, Upload, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const ModelThumbnail = dynamic(
  () => import("@/components/ModelThumbnail").then((m) => m.ModelThumbnail),
  { ssr: false, loading: () => <div className="w-full h-32 rounded-lg bg-muted animate-pulse" /> }
);
const ModelViewerDialog = dynamic(
  () => import("@/components/ModelViewerDialog").then((m) => m.ModelViewerDialog),
  { ssr: false }
);

interface TrackingData {
  id: string;
  customerName: string;
  customerEmail: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deadline?: string | null;
  phase: {
    name: string;
    color: string;
  };
  files: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    source: "CUSTOMER" | "TEAM";
    category: "REFERENCE" | "DESIGN" | "RESULT" | "OTHER";
    orderPartId: string | null;
    createdAt: string;
    notes: Array<{
      id: string;
      posX: number;
      posY: number;
      posZ: number;
      normalX: number;
      normalY: number;
      normalZ: number;
      body: string;
      resolvedAt: string | null;
      createdAt: string;
    }>;
  }>;
  parts?: Array<{
    id: string;
    name: string;
    files: Array<{ filename: string; originalName: string; category: string; orderPartId: string | null; createdAt: string }>;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
  }>;
  surveyResponse?: {
    token: string;
    submittedAt: string | null;
    answers: Array<{ question: string; rating: number }> | null;
  } | null;
  priceEstimate?: number | null;
  verificationRequests?: Array<{
    token: string;
    status: string;
    sentAt: string;
    type: string;
    resolvedAt?: string | null;
    resolvedBy?: string | null;
    orderPartId?: string | null;
    quoteId?: string | null;
    rejectionReason?: string | null;
  }>;
  activeQuote?: {
    id: string;
    version: number;
    status: "SENT" | "APPROVED" | "REJECTED";
    totalCents: number;
    taxCents: number;
    validUntil: string | null;
    sentAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    notes: string | null;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPriceCents: number;
      taxRatePercent: number;
      category: string;
      source: "ESTIMATE" | "FIXED" | "ACTUAL";
    }>;
  } | null;
  activeInvoice?: InvoiceCustomer | null;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function TrackingView({ order, trackingToken }: { order: TrackingData; trackingToken: string }) {
  const router = useRouter();
  const t = useTranslations("track");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verificationRequests, setVerificationRequests] = useState(
    order.verificationRequests ?? []
  );
  const [verifyingToken, setVerifyingToken] = useState<string | null>(null);
  const [rejectingToken, setRejectingToken] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openModelFileId, setOpenModelFileId] = useState<string | null>(null);

  function formatRelativeTime(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return t("just_now");
    if (diffMins < 60) return t("minutes_ago", { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t("hours_ago", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t("days_ago", { count: diffDays });
  }

  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      ORDER_CREATED: t("audit_submitted"),
      PHASE_CHANGED: t("audit_phase_changed"),
      ASSIGNED: t("audit_assigned"),
      COMMENT_ADDED: t("audit_comment_added"),
      FILE_UPLOADED: t("audit_file_uploaded"),
      TEAM_FILE_UPLOADED: t("audit_team_file_uploaded"),
      PART_ITERATION_INCREMENTED: t("audit_iteration_incremented"),
      SURVEY_SENT: t("audit_survey_sent"),
      SURVEY_SUBMITTED: t("audit_survey_submitted"),
      VERIFICATION_SENT: t("audit_verification_sent"),
      VERIFICATION_APPROVED: t("audit_verification_approved"),
      VERIFICATION_REJECTED: t("audit_verification_rejected"),
      VERIFICATION_OVERRIDDEN: t("audit_verification_overridden"),
    };
    return labels[action] ?? action;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const valid = picked.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(tc("file_too_large", { name: f.name }));
        return false;
      }
      return true;
    });
    setSelectedFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  function handleRemoveFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("orderId", order.id);
      selectedFiles.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(t("upload_error"));
      toast.success(t("upload_success"));
      setSelectedFiles([]);
      router.refresh();
    } catch {
      toast.error(t("upload_retry"));
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify(verificationToken: string, action: "APPROVE" | "REJECT", rejectionReason?: string) {
    setVerifyingToken(verificationToken);
    try {
      const res = await fetch(`/api/orders/${trackingToken}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken, action, ...(rejectionReason ? { rejectionReason } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Freigabe fehlgeschlagen");
        return;
      }
      const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      setVerificationRequests((prev) =>
        prev.map((vr) => (vr.token === verificationToken ? { ...vr, status: newStatus } : vr))
      );
      toast.success(action === "APPROVE" ? t("approve") : t("reject"));
      setRejectingToken(null);
      setRejectReason("");
      router.refresh();
    } catch {
      toast.error("Freigabe fehlgeschlagen");
    } finally {
      setVerifyingToken(null);
    }
  }

  const fileCategoryLabels: Record<string, string> = {
    REFERENCE: t("file_cat_reference"),
    DESIGN: t("file_cat_design"),
    RESULT: t("file_cat_result"),
    OTHER: t("file_cat_other"),
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("order_by", { name: order.customerName })}
              </CardTitle>
              <CardDescription>{order.customerEmail}</CardDescription>
            </div>
            <Badge
              style={{ backgroundColor: order.phase.color }}
              className="text-white shrink-0"
            >
              {order.phase.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">{t("submitted_at", { date: formatDateTime(order.createdAt) })}</span>
            </p>
            <p>
              <span className="font-medium text-foreground">{t("updated_at", { date: formatDateTime(order.updatedAt) })}</span>
            </p>
            {order.deadline && (
              <p>
                <span className="font-medium text-foreground">{t("planned_completion", { date: new Date(order.deadline).toLocaleDateString("de-DE") })}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tc("description")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{order.description}</p>
        </CardContent>
      </Card>

      {/* Files */}
      {order.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("files_count", { count: order.files.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="DESIGN">
              <TabsList className="w-full">
                {(["REFERENCE", "DESIGN", "RESULT", "OTHER"] as const).map((cat) => {
                  const count = order.files.filter((f) => f.category === cat).length;
                  return (
                    <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">
                      {fileCategoryLabels[cat]}{count > 0 && <span className="ml-1 opacity-60">({count})</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {(["REFERENCE", "DESIGN", "RESULT", "OTHER"] as const).map((cat) => {
                const catFiles = order.files.filter((f) => f.category === cat);
                return (
                  <TabsContent key={cat} value={cat} className="mt-3 space-y-3">
                    {catFiles.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("no_files_in_category")}</p>
                    )}
                    {catFiles.map((file) => (
                      <div key={file.id} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          {isImage(file.mimeType) ? (
                            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          {is3DModel(file.filename) ? (
                            <button
                              type="button"
                              onClick={() => setOpenModelFileId(file.id)}
                              className="flex-1 truncate text-left hover:underline cursor-pointer text-sm"
                            >
                              {file.originalName}
                            </button>
                          ) : (
                            <span className="flex-1 truncate">{file.originalName}</span>
                          )}
                          {file.source === "TEAM" ? (
                            <Badge variant="secondary" className="text-xs shrink-0">{t("from_team")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs shrink-0">{t("from_you")}</Badge>
                          )}
                          <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(file.size)}</span>
                          <a
                            href={`/api/files/${order.id}/${file.filename}`}
                            download={file.originalName}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                        {isImage(file.mimeType) && (
                          <div
                            className="relative aspect-video rounded-lg overflow-hidden bg-muted group w-full max-w-sm cursor-pointer"
                            onClick={() => setPreviewUrl(`/api/files/${order.id}/${file.filename}`)}
                          >
                            <Image
                              src={`/api/files/${order.id}/${file.filename}`}
                              alt={file.originalName}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ImageIcon className="h-6 w-6 text-white" />
                            </div>
                          </div>
                        )}
                        {is3DModel(file.filename) && (
                          <>
                            <div className="ml-6 border-l-2 border-muted pl-3 w-40">
                              <ModelThumbnail
                                url={`/api/files/${order.id}/${file.filename}`}
                                filename={file.filename}
                                noteCount={file.notes.length}
                                onClick={() => setOpenModelFileId(file.id)}
                                className="h-20"
                              />
                            </div>
                            <ModelViewerDialog
                              open={openModelFileId === file.id}
                              onOpenChange={(open) => { if (!open) setOpenModelFileId(null); }}
                              fileId={file.id}
                              fileUrl={`/api/files/${order.id}/${file.filename}`}
                              filename={file.originalName}
                              mode="customer"
                              initialNotes={file.notes}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Image lightbox */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{t("image_preview")}</DialogTitle>
          {previewUrl && (
            <div className="relative w-full aspect-video">
              <Image src={previewUrl} alt="Vorschau" fill className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Additional File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("upload_more")}</CardTitle>
          <CardDescription>
            {t("upload_more_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              {tc("file_types_3d")}
            </p>
            <p className="text-xs text-muted-foreground mb-3">{tc("max_file_size")}</p>
            <label htmlFor="tracking-file-upload">
              <Button type="button" variant="outline" size="sm" asChild>
                <span className="cursor-pointer">{tc("select_files")}</span>
              </Button>
            </label>
            <input
              id="tracking-file-upload"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.stl,.obj,.3mf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {selectedFiles.length > 0 && (
            <ul className="space-y-2">
              {selectedFiles.map((file, i) => (
                <li key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    aria-label={tc("remove_file", { name: file.name })}
                    className="text-muted-foreground hover:text-destructive p-1 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
            className="w-full"
          >
            {uploading ? tc("uploading") : tc("upload")}
          </Button>
        </CardContent>
      </Card>

      {/* Active invoice — once issued, takes precedence over quote */}
      {order.activeInvoice ? (
        <InvoiceCustomerView
          invoice={order.activeInvoice}
          pdfUrl={`/api/orders/${trackingToken}/invoice-pdf`}
        />
      ) : (
        order.activeQuote && (
          <QuoteCustomerView
            quote={order.activeQuote}
            pdfUrl={`/api/orders/${trackingToken}/quote-pdf`}
          />
        )
      )}

      {/* Verification Requests — pending ones rendered as prominent CTA */}
      {verificationRequests.filter((vr) => vr.status === "PENDING").map((vr) => {
        const partName = vr.orderPartId ? (order.parts ?? []).find((p) => p.id === vr.orderPartId)?.name : null;
        const latestDesignFile = vr.orderPartId
          ? (order.parts ?? []).find((p) => p.id === vr.orderPartId)?.files
              .filter((f) => f.category === "DESIGN")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;
        const isRejecting = rejectingToken === vr.token;
        return (
          <Card key={vr.token} className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                Handlung erforderlich:{" "}
                {vr.type === "DESIGN_REVIEW"
                  ? partName ? `Designfreigabe für „${partName}"` : t("approve_design_prompt")
                  : t("approve_price_prompt")}
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                {vr.type === "DESIGN_REVIEW"
                  ? t("design_approval_desc")
                  : t("price_approval_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestDesignFile && (
                <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-amber-900/20 rounded-lg border border-amber-200">
                  <FileText className="h-4 w-4 text-amber-700 shrink-0" />
                  <span className="text-sm font-medium text-amber-800 flex-1 truncate">{latestDesignFile.originalName}</span>
                  <a
                    href={`/api/files/${order.id}/${latestDesignFile.filename}`}
                    download={latestDesignFile.originalName}
                    className="text-amber-700 hover:text-amber-900 shrink-0"
                    title="Herunterladen"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              )}
              {vr.type === "PRICE_APPROVAL" && order.priceEstimate != null && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {t("price_label", { price: order.priceEstimate.toFixed(2) })}
                </p>
              )}
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("request_sent_at", { time: formatRelativeTime(vr.sentAt) })}
              </p>
              {isRejecting ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder={t("rejection_reason")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="text-sm min-h-[80px] resize-none bg-white"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="destructive"
                      onClick={() => handleVerify(vr.token, "REJECT", rejectReason)}
                      disabled={verifyingToken === vr.token}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {verifyingToken === vr.token ? t("processing") : t("confirm_reject")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRejectingToken(null); setRejectReason(""); }}
                      className="flex-1"
                    >
                      {tc("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleVerify(vr.token, "APPROVE")}
                    disabled={verifyingToken === vr.token}
                    className="flex-1"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {verifyingToken === vr.token ? t("processing") : t("approve")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectingToken(vr.token)}
                    disabled={verifyingToken === vr.token}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("reject")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Resolved verification requests */}
      {verificationRequests.some((vr) => vr.status !== "PENDING") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("approvals_section")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationRequests.filter((vr) => vr.status !== "PENDING").map((vr) => (
              <div key={vr.token} className="flex items-start justify-between gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {vr.type === "DESIGN_REVIEW" ? t("design_approval") : t("price_approval")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("request_sent_full", { date: formatDateTime(vr.sentAt) })}
                  </p>
                  {vr.resolvedAt && (
                    <p className="text-xs text-muted-foreground">
                      {vr.status === "APPROVED"
                        ? t("approved_at", { date: formatDateTime(vr.resolvedAt) })
                        : t("rejected_at", { date: formatDateTime(vr.resolvedAt) })}
                    </p>
                  )}
                  {vr.status === "REJECTED" && vr.rejectionReason && (
                    <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 mt-1">
                      „{vr.rejectionReason}"
                    </p>
                  )}
                </div>
                {vr.status === "APPROVED" && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                    <ShieldCheck className="h-3 w-3" />
                    {t("approved")}
                  </span>
                )}
                {vr.status === "REJECTED" && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 shrink-0">
                    <XCircle className="h-3 w-3" />
                    {t("rejected")}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Survey CTA */}
      {order.surveyResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t("feedback_section")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.surveyResponse.submittedAt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("feedback_thanks")}</p>
                {order.surveyResponse.answers && order.surveyResponse.answers.length > 0 && (
                  <div className="space-y-2">
                    {order.surveyResponse.answers.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{a.question}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <Star
                              key={v}
                              className={`h-3.5 w-3.5 ${v <= a.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("feedback_prompt")}
                </p>
                <Button asChild size="sm">
                  <Link href={`/survey/${order.surveyResponse.token}`}>
                    {t("feedback_cta")}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline / Audit Log */}
      {order.auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border space-y-4 ml-3">
              {order.auditLogs.map((log, idx) => (
                <li key={log.id} className="ml-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                    {idx === 0 ? (
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {getActionLabel(log.action)}
                    </p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
