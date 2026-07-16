"use client";

// The admin page around the in-page editor: a header, and the publish controls.
//
// All content editing happens inside the preview iframe (on the blocks
// themselves — see components/landing/edit/). What is left here is what has no
// place on the page: the language and width of the preview, the one-time step
// that turns the defaults into an editable draft, and — because draft edits stay
// private — the Publish / Discard controls that decide what visitors see.

import { useEffect, useState } from "react";
import { CloudUpload, ExternalLink, Lock, Monitor, Smartphone, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PublishState } from "@/lib/landing/publish";
import type { Locale } from "@/i18n/locale";

export function LandingManager({
  pristine,
  publishState,
  readOnly,
}: {
  pristine: boolean;
  publishState: PublishState;
  readOnly: boolean;
}) {
  const t = useTranslations("admin");
  const [isPristine, setIsPristine] = useState(pristine);
  const [state, setState] = useState<PublishState>(publishState);
  const [locale, setLocale] = useState<Locale>("de");
  const [wide, setWide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Bumping this key remounts the iframe — used to pull a reverted draft after
  // Discard, and to flip it into edit mode after the first "Customize page".
  const [reloadKey, setReloadKey] = useState(0);

  const editable = !readOnly && !isPristine;

  // The preview reports upward whenever the draft changes, so the Publish button
  // can light up without the frame re-fetching. See LandingEditProvider.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === "landing-dirty") {
        setState("unpublished");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function post(path: string): Promise<Response> {
    const res = await fetch(path, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? t("landing_save_failed"));
    }
    return res;
  }

  async function initDefaults() {
    setBusy(true);
    try {
      await post("/api/admin/landing/init");
      setIsPristine(false);
      setState("unpublished");
      setReloadKey((k) => k + 1);
      toast.success(t("landing_init_done"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("landing_save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await post("/api/admin/landing/publish");
      setState("published");
      toast.success(t("landing_publish_done"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("landing_save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    setBusy(true);
    try {
      const res = await post("/api/admin/landing/discard");
      const { state: next } = (await res.json()) as { state: PublishState };
      setState(next);
      setIsPristine(next === "pristine");
      // The draft changed underneath the preview — pull the reverted version.
      setReloadKey((k) => k + 1);
      toast.success(t("landing_discard_done"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("landing_save_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("landing_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {editable ? t("landing_subtitle_editable") : t("landing_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <span
              data-testid="landing-publish-status"
              className={`hidden text-xs font-medium sm:inline ${
                state === "unpublished" ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
              }`}
            >
              {state === "unpublished" ? t("landing_status_unpublished") : t("landing_status_published")}
            </span>
          )}

          <div className="flex rounded-md border p-0.5">
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                data-testid={`landing-locale-${l}`}
                aria-pressed={locale === l}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="hidden rounded-md border p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setWide(true)}
              aria-pressed={wide}
              aria-label={t("landing_preview_desktop")}
              className={`rounded px-2 py-1 ${wide ? "bg-muted" : "text-muted-foreground"}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWide(false)}
              aria-pressed={!wide}
              aria-label={t("landing_preview_mobile")}
              className={`rounded px-2 py-1 ${!wide ? "bg-muted" : "text-muted-foreground"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <Button asChild variant="outline" size="sm">
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              {t("landing_view_page")}
            </a>
          </Button>

          {editable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || state !== "unpublished"}
                onClick={() => setConfirmDiscard(true)}
                data-testid="landing-discard"
              >
                <Undo2 className="h-4 w-4" />
                {t("landing_discard")}
              </Button>
              <Button
                size="sm"
                disabled={busy || state !== "unpublished"}
                onClick={publish}
                data-testid="landing-publish"
              >
                <CloudUpload className="h-4 w-4" />
                {t("landing_publish")}
              </Button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div
          data-testid="landing-readonly-banner"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm"
        >
          <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span>{t("landing_readonly_banner")}</span>
        </div>
      )}

      {isPristine && !readOnly && (
        <div
          data-testid="landing-pristine-banner"
          className="flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-muted-foreground">{t("landing_pristine_banner")}</span>
          <Button size="sm" disabled={busy} onClick={initDefaults}>
            {t("landing_init_cta")}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border bg-muted/30 p-2 min-h-0">
        {/* edit=1 asks for the in-page editor; the page grants it only to a
            session holding landing.edit. `key` forces a remount when a control
            changes or the draft is reverted, so the frame always reflects them. */}
        <iframe
          key={`${locale}-${editable}-${reloadKey}`}
          src={`/?preview_locale=${locale}${editable ? "&edit=1" : ""}`}
          title={t("landing_preview")}
          data-testid="landing-preview"
          className={`mx-auto h-full min-h-[640px] w-full rounded border bg-white transition-[max-width] ${
            wide ? "max-w-none" : "max-w-[420px]"
          }`}
        />
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("landing_discard_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("landing_discard_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("landing_delete_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={discard}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("landing_discard_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
