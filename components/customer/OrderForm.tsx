"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X, FileText, Image, CheckCircle2, Copy, ExternalLink, AlertTriangle, KeyRound } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { CONTENT } from "@/app/content";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "model/stl",
  "application/octet-stream",
  ".stl",
  ".obj",
  ".3mf",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function OrderForm({ accessCodeEnabled = false }: { accessCodeEnabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    description: "",
    deadline: "",
    accessCode: "",
  });
  const [submitted, setSubmitted] = useState<{ trackingToken: string } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} ist zu groß (max. 50MB)`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function isImage(file: File) {
    return file.type.startsWith("image/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.customerName || !formData.customerEmail || !formData.description) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    setLoading(true);

    try {
      // First create the order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          description: formData.description,
          deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
          ...(accessCodeEnabled ? { accessCode: formData.accessCode } : {}),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? "Auftrag konnte nicht erstellt werden");
      }

      const { orderId, trackingToken } = await orderRes.json();

      // Upload files if any
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("orderId", orderId);
        files.forEach((f) => fd.append("files", f));

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: fd,
        });

        if (!uploadRes.ok) {
          toast.warning("Auftrag erstellt, aber Datei-Upload fehlgeschlagen");
        }
      }

      setSubmitted({ trackingToken });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    const trackingUrl =
      (typeof window !== "undefined" ? window.location.origin : "") +
      `/track/${submitted.trackingToken}`;

    function handleCopy() {
      navigator.clipboard.writeText(trackingUrl).then(() => {
        toast.success("Link kopiert!");
      });
    }

    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-1">Auftrag erfolgreich eingereicht!</h2>
            <p className="text-muted-foreground text-sm">
              Ihr Auftrag wurde registriert. Bitte speichern Sie den folgenden Tracking-Link.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Wichtig:</strong> Speichern Sie diesen Link! Eine Bestätigungs-E-Mail
              mit dem Link wurde an Ihre E-Mail-Adresse gesendet.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Ihr Tracking-Link</Label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all border">
                {trackingUrl}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4 mr-2" />
                Link kopieren
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => router.push(`/track/${submitted.trackingToken}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Zum Auftrag
              </Button>
            </div>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Ihr 3D-Druck Tracking-Link:\n${trackingUrl}`)}`}
              download="tracking-link.txt"
              className="block text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Als Textdatei herunterladen
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>3D-Druck Auftrag einreichen</CardTitle>
        <CardDescription>
          Beschreibe deinen Auftrag und lade Dateien oder Bilder hoch. Du erhältst einen
          Tracking-Link zum Verfolgen deines Auftrags.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name *</Label>
              <Input
                id="customerName"
                placeholder="Max Mustermann"
                value={formData.customerName}
                onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">E-Mail *</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="max@example.com"
                value={formData.customerEmail}
                onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung *</Label>
            <Textarea
              id="description"
              placeholder="Beschreibe deinen 3D-Druck Auftrag: Material, Farbe, Größe, Verwendungszweck..."
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Wunschdatum (optional)</Label>
            <Input
              id="deadline"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={formData.deadline}
              onChange={(e) => setFormData((p) => ({ ...p, deadline: e.target.value }))}
            />
          </div>

          {accessCodeEnabled && (
            <div className="space-y-2">
              <Label htmlFor="accessCode">
                <KeyRound className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                {CONTENT.accessCode.label} *
              </Label>
              <Input
                id="accessCode"
                type="text"
                placeholder={CONTENT.accessCode.placeholder}
                value={formData.accessCode}
                onChange={(e) => setFormData((p) => ({ ...p, accessCode: e.target.value }))}
                required
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-3">
            <Label>Dateien (optional)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Bilder (JPG, PNG) oder 3D-Dateien (STL, OBJ, 3MF)
              </p>
              <p className="text-xs text-muted-foreground mb-3">Max. 50MB pro Datei</p>
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">Dateien auswählen</span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.stl,.obj,.3mf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((file, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm"
                  >
                    {isImage(file) ? (
                      <Image className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Datei entfernen: ${file.name}`}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird eingereicht..." : "Auftrag einreichen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
