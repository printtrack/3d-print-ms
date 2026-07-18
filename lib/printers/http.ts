/** fetch with an abort timeout, so a dead printer can't hang a dispatch. */
export async function fetchTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Drucker nicht erreichbar (Timeout)");
    }
    throw new Error(err instanceof Error ? err.message : "Netzwerkfehler");
  } finally {
    clearTimeout(timer);
  }
}

/** Join a base URL and a path without doubling or dropping the slash. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Parse a JSON response, but fail with a clear message when the server returned
 * HTML instead (e.g. a cloud SPA / login page for an unknown endpoint) — avoids
 * the cryptic `Unexpected token '<'` that a bare res.json() would throw.
 */
export async function readJson<T>(res: Response, label: string): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    throw new Error(
      `${label}: unerwartete Antwort (kein JSON, HTTP ${res.status}). API-Key und URL prüfen.`
    );
  }
  return (await res.json()) as T;
}

/** True when a response is JSON (used to opportunistically read optional data). */
export function isJson(res: Response): boolean {
  return (res.headers.get("content-type") || "").includes("json");
}
