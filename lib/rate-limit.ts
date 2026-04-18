import { NextRequest } from "next/server";

type Window = { count: number; resetAt: number };
const store = new Map<string, Window>();

// Periodic cleanup of expired entries
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key);
  }
}, 5 * 60_000);
if (typeof cleanup.unref === "function") cleanup.unref();

/**
 * Returns true if the key has exceeded the limit (should be rate-limited).
 * Returns false if the request is within limits.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (process.env.DISABLE_RATE_LIMIT === "true") return false;
  const now = Date.now();
  const win = store.get(key);
  if (!win || win.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  win.count++;
  return win.count > limit;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
