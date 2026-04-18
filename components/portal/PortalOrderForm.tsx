"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X, FileText, Image } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface Props {
  customerName: string;
  customerEmail: string;
}

export function PortalOrderForm({ customerName, customerEmail }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

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
    if (!description) {
      toast.error("Bitte eine Beschreibung eingeben");
      return;
    }

    setLoading(true);

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          description,
          deadline: deadline ? new Date(deadline).toISOString() : null,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? "Auftrag konnte nicht erstellt werden");
      }

      const { orderId } = await orderRes.json();

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

      router.push(`/portal/orders/${orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Neuen Auftrag einreichen</CardTitle>
        <CardDescription>
          Auftrag wird eingereicht als:{" "}
          <span className="font-medium text-foreground">
            {customerName} ({customerEmail})
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung *</Label>
            <Textarea
              id="description"
              placeholder="Beschreibe deinen 3D-Druck Auftrag: Material, Farbe, Größe, Verwendungszweck..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Wunschdatum (optional)</Label>
            <Input
              id="deadline"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

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
