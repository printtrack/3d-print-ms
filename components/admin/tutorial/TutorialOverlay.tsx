"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { useTutorial } from "@/lib/tutorial/use-tutorial";
import { TUTORIAL_STEPS, STEP_COUNT } from "@/lib/tutorial/steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rect { top: number; left: number; width: number; height: number }
const PADDING = 6;
const RADIUS = 10;
const DARK = "rgba(0,0,0,0.60)";

// Per step: priority-ordered selectors — first visible one in DOM wins.
// The MutationObserver continuously re-evaluates this list as the DOM changes.
const SPOTLIGHT_PRIORITY: Partial<Record<string, string[]>> = {
  jobs_plan: [
    '[data-tutorial="plan-jobs-confirm"]',
    '[data-tutorial="plan-jobs-btn"]',
  ],
  job_verify: [
    '[data-tutorial="verify-complete-btn"]:not([disabled])',
    '[data-tutorial="verify-success-btn"]',
    '[data-tutorial="druck-verifizieren"]',
    '[data-tutorial="awaiting-job"]',
  ],
  filament_select: [
    '[data-tutorial="filament-dropdown"]',
    '[data-tutorial="filament-btn"]',
  ],
  part_phase: [
    '[data-tutorial="part-phase-dropdown"]',
    '[data-tutorial="part-phase-btn"]',
  ],
};

interface Props {
  onSkip: () => void;
}

export function TutorialOverlay({ onSkip }: Props) {
  const { state, advance, back } = useTutorial();
  const t = useTranslations("tutorial");
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const mutObserverRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number>(0);

  const currentDef = TUTORIAL_STEPS.find((s) => s.id === state.step);

  function getEffectiveSelector(): string | null {
    const priorities = SPOTLIGHT_PRIORITY[state.step];
    if (priorities) {
      // Return the first visible element's selector
      for (const sel of priorities) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const r = (el as HTMLElement).getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return sel;
          }
        } catch { /* invalid selector */ }
      }
      return null;
    }
    return currentDef?.targetSelector ?? null;
  }

  function measureAndSnap() {
    const sel = getEffectiveSelector();
    if (!sel) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(sel);
    if (!el) { setTargetRect(null); return; }
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setTargetRect(null); return; }
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }

  useLayoutEffect(() => {
    setVisible(false);
    setTargetRect(null);
    observerRef.current?.disconnect();
    mutObserverRef.current?.disconnect();

    // Poll until target is found, then install observers
    let retries = 0;
    function tryAttach() {
      const sel = getEffectiveSelector();
      if (!sel) {
        if (currentDef?.targetSelector || SPOTLIGHT_PRIORITY[state.step]) {
          if (retries++ < 30) { rafRef.current = requestAnimationFrame(tryAttach); return; }
        }
        setVisible(true);
        installMutObserver();
        return;
      }
      const el = document.querySelector(sel);
      if (!el) { retries = 0; rafRef.current = requestAnimationFrame(tryAttach); return; }
      const r = (el as HTMLElement).getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      observerRef.current = new ResizeObserver(() => rafRef.current = requestAnimationFrame(measureAndSnap));
      observerRef.current.observe(el);
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "nearest" });
      setVisible(true);
      installMutObserver();
    }

    function installMutObserver() {
      // Watch for DOM changes that might reveal a higher-priority target
      const hasPriority = !!SPOTLIGHT_PRIORITY[state.step];
      if (!hasPriority) return;
      mutObserverRef.current = new MutationObserver(() => {
        // Use a short delay so dialogs finish animating before we snap
        setTimeout(() => {
          const prevSel = getEffectiveSelector();
          measureAndSnap();
          const newSel = getEffectiveSelector();
          if (newSel !== prevSel && newSel) {
            const el = document.querySelector(newSel);
            if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "nearest" });
            // Update ResizeObserver to new element
            observerRef.current?.disconnect();
            observerRef.current = new ResizeObserver(() => rafRef.current = requestAnimationFrame(measureAndSnap));
            observerRef.current.observe(el!);
          }
        }, 150);
      });
      mutObserverRef.current.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-verified", "disabled", "data-state"] });
    }

    const id = requestAnimationFrame(tryAttach);
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(rafRef.current);
      observerRef.current?.disconnect();
      mutObserverRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  useEffect(() => {
    function onScroll() { rafRef.current = requestAnimationFrame(measureAndSnap); }
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  if (!currentDef) return null;

  const sp = targetRect ? {
    top: targetRect.top - PADDING,
    left: targetRect.left - PADDING,
    width: targetRect.width + PADDING * 2,
    height: targetRect.height + PADDING * 2,
  } : null;

  const stepNumber = TUTORIAL_STEPS.filter(
    (s) => s.id !== "welcome" && s.id !== "complete"
  ).findIndex((s) => s.id === state.step) + 1;

  const titleKey = `steps.${state.step}.title` as Parameters<typeof t>[0];
  const bodyKey = `steps.${state.step}.body` as Parameters<typeof t>[0];
  const hintKey = `steps.${state.step}.hint` as Parameters<typeof t>[0];

  function getPopoverStyle(): React.CSSProperties {
    if (!sp) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    const gap = 14;
    switch (currentDef!.placement) {
      case "right":
        return { top: sp.top + sp.height / 2, left: sp.left + sp.width + gap, transform: "translateY(-50%)" };
      case "left":
        return { top: sp.top + sp.height / 2, left: sp.left - gap, transform: "translate(-100%,-50%)" };
      case "top":
        return { top: sp.top - gap, left: sp.left + sp.width / 2, transform: "translate(-50%,-100%)" };
      case "bottom":
      default:
        return { top: sp.top + sp.height + gap, left: sp.left + sp.width / 2, transform: "translateX(-50%)" };
    }
  }

  return (
    <div
      className={cn("fixed inset-0 pointer-events-none transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
      style={{ zIndex: 9990 }}
      aria-hidden="true"
    >
      {currentDef.allowFullInteraction ? (
        /* Full-interaction steps (e.g. 3D viewer): visual-only dim — no click blocking */
        <>
          {sp ? (
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
              <defs>
                <mask id="tutorial-mask-fi">
                  <rect width="100%" height="100%" fill="white" />
                  <rect x={sp.left} y={sp.top} width={sp.width} height={sp.height} rx={RADIUS} ry={RADIUS} fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill={DARK} mask="url(#tutorial-mask-fi)" />
              <rect x={sp.left - 1} y={sp.top - 1} width={sp.width + 2} height={sp.height + 2}
                rx={RADIUS + 1} ry={RADIUS + 1} fill="none"
                stroke="oklch(0.72 0.18 55)" strokeWidth="2" className="tutorial-ring" />
            </svg>
          ) : (
            <div style={{ position: "fixed", inset: 0, background: DARK }} />
          )}
        </>
      ) : sp ? (
        /* Blocking spotlight: 4 dark panels + amber ring */
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: sp.top, background: DARK, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sp.top + sp.height, left: 0, right: 0, bottom: 0, background: DARK, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sp.top, left: 0, width: sp.left, height: sp.height, background: DARK, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sp.top, left: sp.left + sp.width, right: 0, height: sp.height, background: DARK, pointerEvents: "auto" }} />
          <div
            className="tutorial-ring"
            style={{
              position: "fixed",
              top: sp.top, left: sp.left, width: sp.width, height: sp.height,
              border: "2px solid oklch(0.72 0.18 55)",
              borderRadius: RADIUS,
              boxShadow: "0 0 0 6px oklch(0.72 0.18 55 / 0.15)",
              pointerEvents: "none",
              zIndex: 9991,
            }}
          />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: DARK, pointerEvents: "auto" }} />
      )}

      {/* Coachmark — position:fixed so it's always above all panels and dialogs */}
      <div
        className={cn(
          "fixed w-80 pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={{ ...getPopoverStyle(), zIndex: 9999 }}
      >
        <div className="bg-card rounded-lg shadow-xl border border-border overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
            style={{ backgroundColor: "oklch(0.72 0.18 55)" }}
          />
          <div className="pl-4 pr-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge variant="secondary" className="text-xs font-normal tabular-nums">
                {t("controls.progress", { current: stepNumber, total: STEP_COUNT })}
              </Badge>
              <button
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 -mt-0.5"
                aria-label={t("controls.skip")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-semibold text-sm leading-snug mb-1">{t(titleKey)}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t(bodyKey)}</p>
            {t.has(hintKey) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                {t(hintKey)}
              </p>
            )}
          </div>

          {(currentDef.showNext || currentDef.id === "viewer_guide") && (
            <div className="px-4 pb-3 flex justify-end border-t border-border/60 pt-3">
              <Button size="sm" className="h-8" style={{ backgroundColor: "oklch(0.72 0.18 55)" }} onClick={advance}>
                {t("controls.next")}
              </Button>
            </div>
          )}

          {!currentDef.showNext && currentDef.id !== "viewer_guide" && (
            <div className="px-4 pb-3 pt-2">
              <p className="text-xs text-muted-foreground/70 italic">{t("controls.waiting")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
