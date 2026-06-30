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
import { useTranslations } from "next-intl";
import { OrderTypeField, type OrderType } from "@/components/customer/OrderTypeField";
import { SourceLinksField, type SourceLink } from "@/components/customer/SourceLinksField";
import { SUPPORTED_FORMATS, DEFAULT_MAX_FILE_MB, type OrderFormConfig } from "@/lib/order-form-config";

const DEFAULT_CONFIG: OrderFormConfig = {
  deadlineVisible: true,
  deadlineRequired: false,
  orderTypeVisible: true,
  acceptedFormats: [...SUPPORTED_FORMATS],
  maxFileMb: DEFAULT_MAX_FILE_MB,
  maxFiles: 0,
  consentRequired: false,
  introText: "",
  consentText: "",
};

export function OrderForm({
  accessCodeEnabled = false,
  config = DEFAULT_CONFIG,
}: {
  accessCodeEnabled?: boolean;
  config?: OrderFormConfig;
}) {
  const router = useRouter();
  const t = useTranslations("order_form");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("PRINT_ONLY");
  const [sourceLinks, setSourceLinks] = useState<SourceLink[]>([]);
  const [consent, setConsent] = useState(false);
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
    const maxBytes = config.maxFileMb * 1024 * 1024;
    const valid = selected.filter((f) => {
      if (f.size > maxBytes) {
        toast.error(tc("file_too_large", { name: f.name }));
        return false;
      }
      const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!config.acceptedFormats.includes(ext)) {
        toast.error(t("file_type_not_allowed", { name: f.name }));
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (config.maxFiles > 0 && combined.length > config.maxFiles) {
        toast.error(t("max_files_error", { count: config.maxFiles }));
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
    if (!formData.customerName || !formData.customerEmail || !formData.description) {
      toast.error(t("required_fields_error"));
      return;
    }
    if (config.deadlineVisible && config.deadlineRequired && !formData.deadline) {
      toast.error(t("deadline_required_error"));
      return;
    }
    if (config.consentRequired && !consent) {
      toast.error(t("consent_required_error"));
      return;
    }

    const effectiveOrderType: OrderType = config.orderTypeVisible ? orderType : "PRINT_ONLY";

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
          orderType: effectiveOrderType,
          sourceLinks:
            effectiveOrderType === "PRINT_ONLY"
              ? sourceLinks
                  .filter((l) => l.url.trim().length > 0)
                  .map((l) => ({ url: l.url.trim(), label: l.label.trim() || undefined }))
              : [],
          consentAccepted: consent,
          ...(accessCodeEnabled ? { accessCode: formData.accessCode } : {}),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? t("create_error"));
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
          toast.warning(t("upload_partial_error"));
        }
      }

      setSubmitted({ trackingToken });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("unknown_error"));
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
        toast.success(t("copied_link"));
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
            <h2 className="text-xl font-bold mb-1">{t("success_title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("success_desc")}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>{t("success_important")}</strong> {t("success_save_link")}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("tracking_link_label")}</Label>
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
                {t("copy_link")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => router.push(`/track/${submitted.trackingToken}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("go_to_order")}
              </Button>
            </div>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Ihr 3D-Druck Tracking-Link:\n${trackingUrl}`)}`}
              download="tracking-link.txt"
              className="block text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {t("download_txt")}
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {config.introText && (
            <p className="text-sm text-muted-foreground whitespace-pre-line rounded-md bg-muted/50 p-3">
              {config.introText}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">{t("name_label")}</Label>
              <Input
                id="customerName"
                placeholder={t("name_placeholder")}
                value={formData.customerName}
                onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">{t("email_label")}</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder={t("email_placeholder")}
                value={formData.customerEmail}
                onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
                required
              />
            </div>
          </div>

          {config.orderTypeVisible && (
            <OrderTypeField value={orderType} onChange={setOrderType} />
          )}

          {config.orderTypeVisible && orderType === "PRINT_ONLY" && (
            <SourceLinksField value={sourceLinks} onChange={setSourceLinks} />
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("description_label")}</Label>
            <Textarea
              id="description"
              placeholder={
                orderType === "PRINT_ONLY"
                  ? t("description_placeholder_print")
                  : t("description_placeholder")
              }
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </div>

          {config.deadlineVisible && (
            <div className="space-y-2">
              <Label htmlFor="deadline">
                {t("deadline_label")}{config.deadlineRequired ? " *" : ""}
              </Label>
              <Input
                id="deadline"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={formData.deadline}
                onChange={(e) => setFormData((p) => ({ ...p, deadline: e.target.value }))}
                required={config.deadlineRequired}
              />
            </div>
          )}

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
            <Label>{t("files_label")}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {config.acceptedFormats.map((f) => f.replace(".", "").toUpperCase()).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {t("max_size_hint", { mb: config.maxFileMb })}
                {config.maxFiles > 0 ? ` · ${t("max_files_hint", { count: config.maxFiles })}` : ""}
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
                      aria-label={t("remove_file", { name: file.name })}
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
                aria-label={t("consent_aria")}
              />
              <span>{config.consentText || t("consent_default")}</span>
            </label>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? tc("submitting") : tc("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
