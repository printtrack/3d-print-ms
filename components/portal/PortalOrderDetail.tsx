"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileIcon, FileText, Clock, Download, Upload, X, ShieldCheck, ShieldAlert, XCircle, Image as ImageIcon } from "lucide-react";
import { is3DModel, formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

const ModelViewer = dynamic(
  () => import("@/components/ModelViewer").then((m) => m.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 rounded-lg bg-muted animate-pulse" />
    ),
  }
);

interface Phase {
  id: string;
  name: string;
  color: string;
}

interface OrderFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  source: string;
  category: "REFERENCE" | "DESIGN" | "RESULT" | "OTHER";
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface VerificationRequest {
  token: string;
  status: string;
  sentAt: string;
  resolvedAt: string | null;
  type: string;
}

interface SurveyResponse {
  token: string;
  sentAt: string;
  submittedAt: string | null;
}

interface Order {
  id: string;
  trackingToken: string;
  customerName: string;
  customerEmail: string;
  description: string;
  createdAt: string;
  deadline: string | null;
  priceEstimate: number | null;
  phase: Phase;
  files: OrderFile[];
  auditLogs: AuditLog[];
  verificationRequests: VerificationRequest[];
  surveyResponse: SurveyResponse | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function PortalOrderDetail({ order }: { order: Order }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState<string | null>(null);
  const [verificationRequests, setVerificationRequests] = useState(order.verificationRequests);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pendingVerifications = verificationRequests.filter((vr) => vr.status === "PENDING");

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

  async function handleVerify(verificationToken: string, action: "APPROVE" | "REJECT") {
    setVerifyingToken(verificationToken);
    try {
      const res = await fetch(`/api/orders/${order.trackingToken}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken, action }),
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
      router.refresh();
    } catch {
      toast.error("Freigabe fehlgeschlagen");
    } finally {
      setVerifyingToken(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: order.phase.color }}
          />
          <Badge variant="secondary">{order.phase.name}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Eingereicht am {new Date(order.createdAt).toLocaleDateString("de-DE")}
          {order.deadline && (
            <> · Frist: {new Date(order.deadline).toLocaleDateString("de-DE")}</>
          )}
          {order.priceEstimate !== null && (
            <> · Preisschätzung: {order.priceEstimate.toFixed(2)} €</>
          )}
        </p>
      </div>

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
                          {file.mimeType.startsWith("image/") ? (
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
                        {file.mimeType.startsWith("image/") && (
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

      {/* File Upload */}
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
            <label htmlFor="portal-file-upload">
              <Button type="button" variant="outline" size="sm" asChild>
                <span className="cursor-pointer">Dateien auswählen</span>
              </Button>
            </label>
            <input
              id="portal-file-upload"
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
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="text-muted-foreground hover:text-destructive"
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

      {/* Verification Requests */}
      {pendingVerifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Freigabe erforderlich
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingVerifications.map((vr) => (
              <div key={vr.token} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {vr.type === "DESIGN_REVIEW" ? "Designfreigabe" : "Angebotsfreigabe"}
                  </span>
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    Ihre Freigabe ist erforderlich
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleVerify(vr.token, "APPROVE")}
                    disabled={verifyingToken === vr.token}
                    className="flex-1"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    Freigabe erteilen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerify(vr.token, "REJECT")}
                    disabled={verifyingToken === vr.token}
                    className="flex-1 text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Ablehnen
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Survey */}
      {order.surveyResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ihr Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {order.surveyResponse.submittedAt ? (
              <p className="text-sm text-muted-foreground">Bewertung abgegeben — Danke!</p>
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

      {/* Audit log */}
      {order.auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {order.auditLogs.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground">{log.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("de-DE")}
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
