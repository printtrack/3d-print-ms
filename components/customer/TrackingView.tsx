"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

const ModelViewer = dynamic(
  () => import("@/components/ModelViewer").then((m) => m.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 rounded-lg bg-muted animate-pulse" />
    ),
  }
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
    rejectionReason?: string | null;
  }>;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function TrackingView({ order, trackingToken }: { order: TrackingData; trackingToken: string }) {
  const router = useRouter();
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const valid = picked.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} ist zu groß (max. 50MB)`);
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
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      toast.success("Dateien erfolgreich hochgeladen");
      setSelectedFiles([]);
      router.refresh();
    } catch {
      toast.error("Upload fehlgeschlagen. Bitte erneut versuchen.");
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
      toast.success(action === "APPROVE" ? "Freigabe erteilt" : "Freigabe abgelehnt");
      setRejectingToken(null);
      setRejectReason("");
      router.refresh();
    } catch {
      toast.error("Freigabe fehlgeschlagen");
    } finally {
      setVerifyingToken(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Auftrag von {order.customerName}
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
              <span className="font-medium text-foreground">Eingereicht:</span>{" "}
              {formatDateTime(order.createdAt)}
            </p>
            <p>
              <span className="font-medium text-foreground">Zuletzt aktualisiert:</span>{" "}
              {formatDateTime(order.updatedAt)}
            </p>
            {order.deadline && (
              <p>
                <span className="font-medium text-foreground">Geplante Fertigstellung:</span>{" "}
                {new Date(order.deadline).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beschreibung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{order.description}</p>
        </CardContent>
      </Card>

      {/* Files */}
      {order.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dateien ({order.files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="DESIGN">
              <TabsList className="w-full">
                {(["REFERENCE", "DESIGN", "RESULT", "OTHER"] as const).map((cat) => {
                  const count = order.files.filter((f) => f.category === cat).length;
                  const labels: Record<string, string> = { REFERENCE: "Referenz", DESIGN: "Design", RESULT: "Druckergebnis", OTHER: "Sonstiges" };
                  return (
                    <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">
                      {labels[cat]}{count > 0 && <span className="ml-1 opacity-60">({count})</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {(["REFERENCE", "DESIGN", "RESULT", "OTHER"] as const).map((cat) => {
                const catFiles = order.files.filter((f) => f.category === cat);
                return (
                  <TabsContent key={cat} value={cat} className="mt-3 space-y-3">
                    {catFiles.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Keine Dateien in dieser Kategorie</p>
                    )}
                    {catFiles.map((file) => (
                      <div key={file.id} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          {isImage(file.mimeType) ? (
                            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="flex-1 truncate">{file.originalName}</span>
                          {file.source === "TEAM" ? (
                            <Badge variant="secondary" className="text-xs shrink-0">Team</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs shrink-0">Von Ihnen</Badge>
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
                          <ModelViewer
                            url={`/api/files/${order.id}/${file.filename}`}
                            filename={file.filename}
                          />
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
          <DialogTitle className="sr-only">Bildvorschau</DialogTitle>
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
          <CardTitle className="text-base">Weitere Dateien hochladen</CardTitle>
          <CardDescription>
            Lade überarbeitete Modelle oder zusätzliche Referenzbilder hoch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Bilder (JPG, PNG) oder 3D-Dateien (STL, OBJ, 3MF)
            </p>
            <p className="text-xs text-muted-foreground mb-3">Max. 50MB pro Datei</p>
            <label htmlFor="tracking-file-upload">
              <Button type="button" variant="outline" size="sm" asChild>
                <span className="cursor-pointer">Dateien auswählen</span>
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
                    aria-label={`Datei entfernen: ${file.name}`}
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
            {uploading ? "Wird hochgeladen..." : "Hochladen"}
          </Button>
        </CardContent>
      </Card>

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
                  ? partName ? `Designfreigabe für „${partName}"` : "Bitte geben Sie das Design frei"
                  : "Bitte bestätigen Sie das Angebot"}
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                {vr.type === "DESIGN_REVIEW"
                  ? "Wir benötigen Ihre Freigabe des Designs, bevor wir mit dem Druck beginnen können."
                  : "Wir benötigen Ihre Zustimmung zum Angebot, bevor wir mit dem Druck beginnen können."}
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
                  Angebotspreis:{" "}
                  <strong className="text-lg">{order.priceEstimate.toFixed(2)} €</strong>
                </p>
              )}
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Anfrage gestellt {formatRelativeTime(vr.sentAt)}
              </p>
              {isRejecting ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Grund für Ablehnung (optional)"
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
                      {verifyingToken === vr.token ? "Wird verarbeitet…" : "Ablehnen bestätigen"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRejectingToken(null); setRejectReason(""); }}
                      className="flex-1"
                    >
                      Abbrechen
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
                    {verifyingToken === vr.token ? "Wird verarbeitet…" : "Freigabe erteilen"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectingToken(vr.token)}
                    disabled={verifyingToken === vr.token}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Ablehnen
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
              Freigaben
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationRequests.filter((vr) => vr.status !== "PENDING").map((vr) => (
              <div key={vr.token} className="flex items-start justify-between gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {vr.type === "DESIGN_REVIEW" ? "Designfreigabe" : "Angebotsfreigabe"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Anfrage gestellt: {formatDateTime(vr.sentAt)}
                  </p>
                  {vr.resolvedAt && (
                    <p className="text-xs text-muted-foreground">
                      {vr.status === "APPROVED" ? "Freigegeben" : "Abgelehnt"} am{" "}
                      {formatDateTime(vr.resolvedAt)}
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
                    Freigegeben
                  </span>
                )}
                {vr.status === "REJECTED" && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 shrink-0">
                    <XCircle className="h-3 w-3" />
                    Abgelehnt
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
              Ihr Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.surveyResponse.submittedAt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Vielen Dank für Ihr Feedback!</p>
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
                  Bitte nehmen Sie an unserer kurzen Umfrage teil – es dauert nur 1–2 Minuten.
                </p>
                <Button asChild size="sm">
                  <Link href={`/survey/${order.surveyResponse.token}`}>
                    Jetzt Feedback geben
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
            <CardTitle className="text-base">Verlauf</CardTitle>
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

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "gerade eben";
  if (diffMins < 60) return `vor ${diffMins} Minute${diffMins === 1 ? "" : "n"}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `vor ${diffHours} Stunde${diffHours === 1 ? "" : "n"}`;
  const diffDays = Math.floor(diffHours / 24);
  return `vor ${diffDays} Tag${diffDays === 1 ? "" : "en"}`;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    ORDER_CREATED: "Auftrag eingereicht",
    PHASE_CHANGED: "Status geändert",
    ASSIGNED: "Bearbeiter zugewiesen",
    COMMENT_ADDED: "Kommentar hinzugefügt",
    FILE_UPLOADED: "Datei hochgeladen",
    TEAM_FILE_UPLOADED: "Designdatei vom Team hochgeladen",
    PART_ITERATION_INCREMENTED: "Design-Iteration erhöht",
    SURVEY_SENT: "Umfrage versandt",
    SURVEY_SUBMITTED: "Umfrage ausgefüllt",
    VERIFICATION_SENT: "Freigabeanfrage versandt",
    VERIFICATION_APPROVED: "Freigabe erteilt",
    VERIFICATION_REJECTED: "Freigabe abgelehnt",
    VERIFICATION_OVERRIDDEN: "Freigabe durch Team erteilt",
  };
  return labels[action] ?? action;
}
