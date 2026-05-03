"use client";

import { useEffect, useRef } from "react";
import type { AdminEvent } from "@/lib/event-bus";

export function useLiveEvents(onEvent: (event: AdminEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/admin/events");
    es.onmessage = (e) => {
      try {
        const event: AdminEvent = JSON.parse(e.data as string);
        onEventRef.current(event);
      } catch {
        // Ignore malformed data or heartbeat comments
      }
    };
    return () => es.close();
  }, []);
}
