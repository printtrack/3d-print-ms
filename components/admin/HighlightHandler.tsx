"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function HighlightHandler({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const el = document.getElementById(`order-${orderId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2");

    const timer = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      router.replace(`/admin?${params.toString()}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [orderId]);

  return null;
}
