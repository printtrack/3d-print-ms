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
import { useTranslations } from "next-intl";
import { OrderTypeField, type OrderType } from "@/components/customer/OrderTypeField";
import { SourceLinksField, type SourceLink } from "@/components/customer/SourceLinksField";
import type { OrderFormConfig } from "@/lib/order-form-config";

interface Props {
  customerName: string;
  customerEmail: string;
  /** Built for the "portal" channel — same rules the API enforces on submit. */
  config: OrderFormConfig;
}

export function PortalOrderForm({ customerName, customerEmail, config }: Props) {
  const router = useRouter();
  const t = useTranslations("portal");
  const tf = useTranslations("order_form");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(config.allowedOrderTypes[0] ?? "PRINT_ONLY");
  const [sourceLinks, setSourceLinks] = useState<SourceLink[]>([]);
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [consent, setConsent] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const maxBytes = config.maxFileMb * 1024 * 1024;
    const valid = selected.filter((f) => {
      if (f.size > maxBytes) {
        toast.error(tc("file_too_large", { name: f.name }));
        return false;
      }
      const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!config.acceptedFormats.includes(ext)) {
        toast.error(tf("file_type_not_allowed", { name: f.name }));
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (config.maxFiles > 0 && combined.length > config.maxFiles) {
        toast.error(tf("max_files_error", { count: config.maxFiles }));
        return combined.slice(0, config.maxFiles);
      }
      return combined;
    });
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
      toast.error(t("new_order_required_error"));
      return;
    }
    if (config.deadlineVisible && config.deadlineRequired && !deadline) {
      toast.error(tf("deadline_required_error"));
      return;
    }
    if (config.consentRequired && !consent) {
      toast.error(tf("consent_required_error"));
      return;
    }

    const effectiveOrderType: OrderType = config.allowedOrderTypes.includes(orderType)
      ? orderType
      : config.allowedOrderTypes[0] ?? "PRINT_ONLY";

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
          orderType: effectiveOrderType,
          consentAccepted: consent,
          sourceLinks:
            effectiveOrderType === "PRINT_ONLY"
              ? sourceLinks
                  .filter((l) => l.url.trim().length > 0)
                  .map((l) => ({ url: l.url.trim(), label: l.label.trim() || undefined }))
              : [],
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? t("new_order_create_error"));
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
          toast.warning(t("new_order_upload_error"));
        }
      }

      router.push(`/portal/orders/${orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("unknown_error"));
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t("new_order_title")}</CardTitle>
        <CardDescription>
          {t("new_order_as", { name: customerName, email: customerEmail })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {config.introText && (
            <p className="text-sm text-muted-foreground whitespace-pre-line rounded-md bg-muted/50 p-3">
              {config.introText}
            </p>
          )}

          {config.allowedOrderTypes.length > 1 && (
            <OrderTypeField value={orderType} onChange={setOrderType} />
          )}

          {orderType === "PRINT_ONLY" && (
            <SourceLinksField value={sourceLinks} onChange={setSourceLinks} />
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("new_order_desc_label")}</Label>
            <Textarea
              id="description"
              placeholder={t("new_order_desc_placeholder")}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {config.deadlineVisible && (
            <div className="space-y-2">
              <Label htmlFor="deadline">
                {t("new_order_deadline")}{config.deadlineRequired ? " *" : ""}
              </Label>
              <Input
                id="deadline"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required={config.deadlineRequired}
              />
            </div>
          )}

          <div className="space-y-3">
            <Label>{t("new_order_files")}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {config.acceptedFormats.map((f) => f.replace(".", "").toUpperCase()).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {tf("max_size_hint", { mb: config.maxFileMb })}
                {config.maxFiles > 0 ? ` · ${tf("max_files_hint", { count: config.maxFiles })}` : ""}
              </p>
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">{tc("select_files")}</span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept={config.acceptedFormats.join(",")}
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

          {config.consentRequired && (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-label={tf("consent_aria")}
              />
              <span>{config.consentText || tf("consent_default")}</span>
            </label>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("new_order_submitting") : t("new_order_submit_cta")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
