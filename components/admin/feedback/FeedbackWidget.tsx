"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Lightbulb, MessageSquarePlus, Camera, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "BUG" | "IMPROVEMENT";

export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  function reset() {
    setType("BUG");
    setTitle("");
    setDescription("");
    setScreenshot(null);
  }

  // Snapshot the current admin page via html2canvas-pro (no browser permission,
  // one click). We briefly close the dialog first so neither it nor its dark
  // backdrop end up in the shot — then reopen it with the captured image so the
  // user can mark where the problem is. html2canvas-pro is used instead of the
  // classic html2canvas because the app's theme relies on oklch colors.
  async function captureScreenshot() {
    setCapturing(true);
    setOpen(false); // hide dialog + overlay so they're not in the screenshot
    try {
      // Wait for the Radix close animation to finish and the DOM to settle.
      await new Promise((r) => setTimeout(r, 250));
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        // Skip the fixed feedback button (tagged with data-html2canvas-ignore).
        ignoreElements: (el) => el.hasAttribute("data-html2canvas-ignore"),
      });
      setScreenshot(canvas.toDataURL("image/png"));
    } catch {
      // capture failed — leave the form usable without a screenshot
    } finally {
      setOpen(true);
      setCapturing(false);
    }
  }

  // Load the captured image into the editable canvas once it renders.
  function initCanvas(node: HTMLCanvasElement | null) {
    canvasRef.current = node;
    if (!node || !screenshot) return;
    const img = new Image();
    img.onload = () => {
      node.width = img.width;
      node.height = img.height;
      const ctx = node.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
    };
    img.src = screenshot;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pointerPos(e);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || !last.current) return;
    const pos = pointerPos(e);
    ctx.strokeStyle = "#f59e0b"; // amber brand accent
    ctx.lineWidth = Math.max(3, canvasRef.current.width / 400);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  }
  function onPointerUp() {
    drawing.current = false;
    last.current = null;
  }

  async function submit() {
    if (title.trim().length < 3 || description.trim().length < 5) {
      toast.error(t("validation"));
      return;
    }
    setSubmitting(true);
    try {
      const flattened = canvasRef.current?.toDataURL("image/png") ?? screenshot;
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          screenshot: screenshot ? flattened : null,
        }),
      });
      if (!res.ok) {
        toast.error(t("error"));
        return;
      }
      const data = (await res.json()) as { githubIssueUrl?: string | null };
      if (data.githubIssueUrl) {
        toast.success(t("success_with_issue"), {
          action: {
            label: t("open_issue"),
            onClick: () => window.open(data.githubIssueUrl!, "_blank"),
          },
        });
      } else {
        toast.success(t("success"));
      }
      reset();
      setOpen(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="feedback-button"
        data-html2canvas-ignore
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg" data-testid="feedback-dialog">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "BUG", icon: Bug, label: t("type_bug") },
                { value: "IMPROVEMENT", icon: Lightbulb, label: t("type_improvement") },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`feedback-type-${opt.value}`}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                    type === opt.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-title">{t("field_title")}</Label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("field_title_placeholder")}
                maxLength={150}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-desc">{t("field_description")}</Label>
              <Textarea
                id="fb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("field_description_placeholder")}
                rows={4}
                maxLength={5000}
              />
            </div>

            {/* Screenshot */}
            <div className="space-y-2">
              {!screenshot ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={captureScreenshot}
                  disabled={capturing}
                >
                  {capturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  {t("add_screenshot")}
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("screenshot_hint")}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setScreenshot(null)}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      {t("remove_screenshot")}
                    </Button>
                  </div>
                  <canvas
                    ref={initCanvas}
                    data-testid="feedback-canvas"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    className="w-full cursor-crosshair touch-none rounded-md border"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>
              {t("cancel")}
            </Button>
            <Button onClick={submit} disabled={submitting} data-testid="feedback-submit">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
