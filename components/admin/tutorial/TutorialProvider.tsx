"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TutorialContext, useTutorialReducer } from "@/lib/tutorial/use-tutorial";
import { createMockFetchHandler, installFetchInterceptor } from "@/lib/tutorial/mock-fetch";
import { TutorialOverlay } from "./TutorialOverlay";
import { TutorialWelcomeDialog } from "./TutorialWelcomeDialog";
import { TutorialCompleteDialog } from "./TutorialCompleteDialog";
import { TUTORIAL_ORDER_ID } from "@/lib/tutorial/sample-data";

interface TutorialProviderProps {
  children: React.ReactNode;
  autoStart?: boolean;
}

const TUTORIAL_ORDER_PATH = `/admin/orders/${TUTORIAL_ORDER_ID}`;

export function TutorialProvider({ children, autoStart = false }: TutorialProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const api = useTutorialReducer();
  const { state, advance, skip, complete, setStep, moveOrder, simulatePrintDone } = api;
  const didAutoStart = useRef(false);

  // Auto-start on first render if flagged
  useEffect(() => {
    if (autoStart && !didAutoStart.current) {
      didAutoStart.current = true;
      api.start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // After welcome: navigate to orders board
  useEffect(() => {
    if (state.active && state.step === "welcome") {
      if (!pathname.startsWith("/admin/orders")) {
        router.push("/admin/orders?tutorial=1");
      }
    }
  }, [state.active, state.step, pathname, router]);

  // When user navigates to order detail: jump to model_viewer step
  useEffect(() => {
    if (!state.active) return;
    if (pathname === TUTORIAL_ORDER_PATH) {
      if (state.step === "open_detail" || state.step === "kanban_drag") {
        setStep("model_viewer");
      }
    }
  }, [state.active, state.step, pathname, setStep]);

  // When step is part_phase done → navigate to jobs
  useEffect(() => {
    if (!state.active) return;
    if (state.step === "jobs_plan" && !pathname.startsWith("/admin/jobs")) {
      router.push("/admin/jobs?tutorial=1");
    }
  }, [state.active, state.step, pathname, router]);

  // Auto-expand part section when entering model_viewer / viewer_guide / filament_select / part_phase
  useEffect(() => {
    if (!state.active) return;
    if (
      pathname !== TUTORIAL_ORDER_PATH ||
      !["model_viewer", "viewer_guide", "filament_select", "part_phase"].includes(state.step)
    ) return;

    const timer = setTimeout(() => {
      const stlBtn = document.querySelector('[data-tutorial="stl-file"]');
      const isVisible = stlBtn && (stlBtn as HTMLElement).getBoundingClientRect().width > 0;
      if (!isVisible) {
        const partSection = document.querySelector('[data-tutorial="part-section"]');
        if (partSection) (partSection as HTMLElement).click();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.active, state.step, pathname]);

  // viewer_guide: if viewer isn't open (e.g. user skipped via Weiter), jump to filament_select.
  // Also advance if the viewer gets closed while on viewer_guide.
  useEffect(() => {
    if (!state.active || state.step !== "viewer_guide") return;

    // Give viewer 600ms to render its controls bar; if not found, skip the step
    const skipTimer = setTimeout(() => {
      const controls = document.querySelector('[data-tutorial="viewer-controls"]');
      if (!controls || (controls as HTMLElement).getBoundingClientRect().width === 0) {
        setStep("filament_select");
      }
    }, 600);

    // If viewer closes while on viewer_guide, advance to filament_select
    const observer = new MutationObserver(() => {
      const controls = document.querySelector('[data-tutorial="viewer-controls"]');
      if (!controls) {
        setStep("filament_select");
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(skipTimer);
      observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.step]);

  // When the viewer controls bar loads (= model loaded) → auto-advance to viewer_guide
  useEffect(() => {
    if (!state.active || state.step !== "model_viewer") return;
    if (pathname !== TUTORIAL_ORDER_PATH) return;

    const observer = new MutationObserver(() => {
      // The controls bar only renders after the STL model has loaded
      const controls = document.querySelector('[data-tutorial="viewer-controls"]');
      if (controls && (controls as HTMLElement).getBoundingClientRect().width > 0) {
        setStep("viewer_guide");
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.step, pathname]);

  const markOnboarded = useCallback(async () => {
    await fetch("/api/admin/me/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }, []);

  // Install / uninstall fetch interceptor
  useEffect(() => {
    if (!state.active) return;

    const handler = createMockFetchHandler({
      onOrderMoved: (phaseId) => {
        moveOrder(phaseId);
        setTimeout(() => advance(), 400);
      },
      onFilamentSelected: () => {
        setTimeout(() => advance(), 400);
      },
      onPartPhaseSet: () => {
        setTimeout(() => advance(), 400);
      },
      onJobsPlanned: () => {
        setTimeout(() => {
          simulatePrintDone();
          advance();
        }, 600);
      },
      onJobVerified: () => {
        setTimeout(() => advance(), 300);
      },
    });

    const uninstall = installFetchInterceptor(handler);
    return uninstall;
  }, [state.active, advance, moveOrder, simulatePrintDone]);

  function handleSkip() {
    skip();
    markOnboarded();
  }

  function handleComplete() {
    complete();
    markOnboarded();
  }

  function handleRestart() {
    fetch("/api/admin/me/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    api.start();
    router.push("/admin/orders?tutorial=1");
  }

  return (
    <TutorialContext.Provider value={{ ...api, currentMockOrder: api.currentMockOrder }}>
      {children}

      {state.active && state.step === "welcome" && (
        <TutorialWelcomeDialog
          onStart={() => {
            advance();
            if (!pathname.startsWith("/admin/orders")) {
              router.push("/admin/orders?tutorial=1");
            }
          }}
          onSkip={handleSkip}
        />
      )}

      {state.active && state.step !== "welcome" && state.step !== "complete" && (
        <TutorialOverlay onSkip={handleSkip} />
      )}

      {state.active && state.step === "complete" && (
        <TutorialCompleteDialog onFinish={handleComplete} onRestart={handleRestart} />
      )}
    </TutorialContext.Provider>
  );
}
