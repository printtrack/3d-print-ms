import { useRef, useState, useCallback, useEffect } from "react";
import { OPEN_BAR_DAYS } from "@/lib/gantt-utils";

export function useGanttResize<T extends { id: string; deadline: string | null }>(
  items: T[],
  onItemsChange: (items: T[]) => void,
  pxD: number,
  patchUrl: (id: string) => string
) {
  const pxDRef = useRef(pxD);
  useEffect(() => { pxDRef.current = pxD; }, [pxD]);

  const resizeDragRef = useRef<{
    itemId: string;
    startClientX: number;
    originalEnd: string | null;
    viewStart: Date;
  } | null>(null);

  const [resizingId, setResizingId] = useState<string | null>(null);
  const hasDraggedRef = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = resizeDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    if (Math.abs(dx) > 3) hasDraggedRef.current = true;
    if (!hasDraggedRef.current) return;

    const deltaDays = Math.round(dx / pxDRef.current);
    const baseDate = drag.originalEnd
      ? new Date(drag.originalEnd)
      : new Date(drag.viewStart.getTime() + OPEN_BAR_DAYS * 86_400_000);
    const newEnd = new Date(baseDate.getTime() + deltaDays * 86_400_000);

    onItemsChange(
      items.map((item) =>
        item.id === drag.itemId ? { ...item, deadline: newEnd.toISOString() } : item
      )
    );
  }, [items, onItemsChange]);

  const handleMouseUp = useCallback(() => {
    const drag = resizeDragRef.current;
    if (!drag) return;
    resizeDragRef.current = null;
    setResizingId(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (!hasDraggedRef.current) return;
    // Do NOT reset hasDraggedRef here — the bar's onClick fires after mouseup
    // and needs to see hasDraggedRef=true to suppress navigation.

    const item = items.find((i) => i.id === drag.itemId);
    if (!item?.deadline) return;

    fetch(patchUrl(drag.itemId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: item.deadline }),
    }).catch(console.error);
  }, [items, patchUrl]);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    document.body.style.cursor = resizingId ? "ew-resize" : "";
    document.body.style.userSelect = resizingId ? "none" : "";
  }, [resizingId]);

  function startResize(itemId: string, clientX: number, deadline: string | null, viewStart: Date) {
    hasDraggedRef.current = false;
    resizeDragRef.current = { itemId, startClientX: clientX, originalEnd: deadline, viewStart };
    setResizingId(itemId);
  }

  return { resizingId, hasDraggedRef, startResize };
}
