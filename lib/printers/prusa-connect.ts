import { randomUUID } from "crypto";
import { fetchTimeout, isJson, joinUrl, readJson } from "./http";
import type { PrinterProfile } from "./registry";
import type {
  PrinterConnectionConfig,
  PrinterProvider,
  PrinterState,
  PrinterStatus,
  UploadFile,
  UploadOptions,
  UploadResult,
} from "./types";

/**
 * Prusa Connect (cloud) — the exact path OrcaSlicer / PrusaSlicer use to reach a
 * Prusa printer from anywhere (no LAN/VPN). Works for the CORE One and other
 * Connect-linked printers.
 *
 * Verified against OrcaSlicer's OctoPrint.cpp: the `PrusaConnect` host extends
 * `PrusaLink` and talks the OctoPrint-compatible API to https://connect.prusa3d.com,
 * authenticating with a SINGLE per-printer API key sent as `X-Api-Key`
 * (Prusa Connect → printer → Settings → API keys). No team id / uuid / OAuth.
 *
 *   test   → GET  {base}/api/version            (validates the API key — what OrcaSlicer checks)
 *   upload → POST {base}/api/files/local        (multipart: file, + print flag)
 *   start  → POST {base}/api/files/local/{name} { command: "select", print: true }
 *   cancel → POST {base}/api/job                { command: "cancel" }
 *
 * NOTE: Prusa Connect's OctoPrint emulation is upload-oriented — /api/version
 * and file upload are supported, but live printer state (/api/printer) may not
 * be. getPrinterStatus therefore validates via /api/version and only reads
 * /api/printer opportunistically, falling back to "ready" so a job can still be
 * sent (Connect queues it until the printer is free). Errors surface as a
 * FAILED dispatch.
 */
export class PrusaConnectProvider implements PrinterProvider {
  private readonly base: string;
  private readonly apiKey: string;

  constructor(config: PrinterConnectionConfig, profile: PrinterProfile | null) {
    if (!config.token) throw new Error("Prusa Connect: API-Key fehlt");
    this.apiKey = config.token;
    this.base = config.baseUrl || profile?.defaultBaseUrl || "https://connect.prusa3d.com";
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "X-Api-Key": this.apiKey, "Accept-Language": "en", ...extra };
  }

  async getPrinterStatus(): Promise<PrinterStatus> {
    // Validate reachability + API key exactly like OrcaSlicer's connection test.
    const vres = await fetchTimeout(joinUrl(this.base, "/api/version"), {
      headers: this.headers(),
    });
    if (vres.status === 401 || vres.status === 403) {
      throw new Error("Prusa Connect: API-Key abgelehnt (401/403).");
    }
    if (!vres.ok) throw new Error(`Prusa Connect: HTTP ${vres.status}`);
    await readJson(vres, "Prusa Connect"); // clear error if HTML instead of JSON

    // Live printer state is best-effort (the emulation may not expose /api/printer).
    try {
      const pres = await fetchTimeout(joinUrl(this.base, "/api/printer"), {
        headers: this.headers(),
      });
      if (pres.ok && isJson(pres)) {
        const data = (await pres.json()) as {
          state?: { text?: string; flags?: Record<string, boolean> };
        };
        const state = mapOctoState(data.state?.text ?? "", data.state?.flags ?? {});
        return {
          state,
          bedOccupied: state === "FINISHED" || state === "PRINTING" || state === "PAUSED",
        };
      }
    } catch {
      // fall through to the "ready" fallback
    }
    // Unknown state → assume ready; Connect queues the job until the printer is free.
    return { state: "READY", bedOccupied: false };
  }

  async uploadJob(file: UploadFile, opts?: UploadOptions): Promise<UploadResult> {
    // Prusa Connect accepts large files on the multipart POST /api/files/local
    // (the v1 PUT path is size-capped by nginx → 413). We build the multipart
    // body by hand so it carries an explicit Content-Length (a streamed FormData
    // can go out chunked, which Connect fails to finalize → 503). Field order
    // and the to_print flag mirror OrcaSlicer's PrusaConnect upload.
    //   to_print=True → "Upload and Print"; omitted → "Upload" (stored only)
    const name = safeName(file.filename);
    const contentType = name.toLowerCase().endsWith(".bgcode")
      ? "application/octet-stream"
      : "text/x.gcode";
    const boundary = `----cms${randomUUID().replace(/-/g, "")}`;
    const CRLF = "\r\n";

    let preamble = `--${boundary}${CRLF}Content-Disposition: form-data; name="path"${CRLF}${CRLF}${CRLF}`;
    if (opts?.startAfterUpload) {
      preamble += `--${boundary}${CRLF}Content-Disposition: form-data; name="to_print"${CRLF}${CRLF}True${CRLF}`;
    }
    preamble += `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${name}"${CRLF}Content-Type: ${contentType}${CRLF}${CRLF}`;
    const body = Buffer.concat([
      Buffer.from(preamble, "utf-8"),
      file.buffer,
      Buffer.from(`${CRLF}--${boundary}--${CRLF}`, "utf-8"),
    ]);

    const res = await fetchTimeout(
      joinUrl(this.base, "/api/files/local"),
      {
        method: "POST",
        headers: this.headers({
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        }),
        body: new Uint8Array(body),
      },
      120000 // cloud relay of a multi-MB file can take a while
    );
    if (!res.ok && res.status !== 201) {
      const respBody = await res.text().catch(() => "");
      throw new Error(
        `Prusa Connect Upload ${res.status}${respBody ? `: ${respBody.slice(0, 300)}` : ""}`
      );
    }
    return { providerRef: `files/local/${name}` };
  }

  async startPrint(_providerRef: string): Promise<void> {
    // No-op: a HELD Prusa Connect dispatch was uploaded with to_queue=True, so
    // Connect already prints it as soon as the printer is free — there is no
    // separate "start now" call in the emulation.
  }

  async cancel(_providerRef: string): Promise<void> {
    await fetchTimeout(joinUrl(this.base, "/api/job"), {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ command: "cancel" }),
    });
  }
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// OctoPrint-style printer state (state.text + state.flags) → our PrinterState.
function mapOctoState(text: string, flags: Record<string, boolean>): PrinterState {
  if (flags.printing) return "PRINTING";
  if (flags.paused || flags.pausing) return "PAUSED";
  if (flags.error) return "ERROR";
  if (flags.finishing) return "FINISHED";
  if (flags.ready || flags.operational) return "IDLE";
  const t = text.toUpperCase();
  if (t.includes("PRINT")) return "PRINTING";
  if (t.includes("FINISH")) return "FINISHED";
  if (t.includes("OPERATIONAL") || t.includes("IDLE") || t.includes("READY")) return "IDLE";
  if (t.includes("ERROR") || t.includes("ATTENTION")) return "ERROR";
  return "OFFLINE";
}
