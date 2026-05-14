"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/i18n/set-locale-action";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "de" ? "en" : "de";
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      aria-label={locale === "de" ? "Switch to English" : "Zu Deutsch wechseln"}
    >
      <span className={locale === "de" ? "text-foreground font-semibold" : ""}>DE</span>
      <span className="opacity-40 mx-0.5">|</span>
      <span className={locale === "en" ? "text-foreground font-semibold" : ""}>EN</span>
    </button>
  );
}
