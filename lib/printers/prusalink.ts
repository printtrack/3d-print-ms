import { fetchTimeout, joinUrl } from "./http";
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
 * Prusa CORE One (and other Buddy-firmware printers: MK4, XL, MINI) via
 * **PrusaLink** — the printer's *local* HTTP API. Auth is an API key sent as
 * `X-Api-Key` (Settings → Network → PrusaLink on the printer, or the PrusaLink
 * web UI).
 *
 * IMPORTANT: this is a LOCAL API. Prusa Connect (the cloud) has no public
 * upload/print REST API, so remote control of a Prusa printer requires the
 * server to reach the printer's PrusaLink endpoint (same LAN, VPN, or a tunnel).
 * `config.baseUrl` is the printer URL, e.g. "http://192.168.1.50".
 *
 * API generation used: PrusaLink v1 (firmware 5.1+). Docs:
 * https://help.prusa3d.com/article/prusa-connect-and-prusalink-explained_403548
 * Endpoint shapes cross-checked against the PrusaLinkPy client.
 *
 * NOTE: not yet validated against live hardware — the CORE One adapter is wired
 * to the documented v1 endpoints; verify against a real printer before relying
 * on it in production. Failures surface as a FAILED dispatch with the message.
 */
export class PrusaLinkProvider implements PrinterProvider {
  private readonly base: string;
  private readonly apiKey: string;
  private readonly storage = "usb";

  constructor(config: PrinterConnectionConfig, _profile: PrinterProfile | null) {
    if (!config.baseUrl) throw new Error("PrusaLink: Host-URL fehlt");
    if (!config.token) throw new Error("PrusaLink: API-Key fehlt");
    this.base = config.baseUrl;
    this.apiKey = config.token;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "X-Api-Key": this.apiKey, ...extra };
  }

  async getPrinterStatus(): Promise<PrinterStatus> {
    const res = await fetchTimeout(joinUrl(this.base, "/api/v1/status"), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`PrusaLink Status ${res.status}`);
    const data = (await res.json()) as {
      printer?: { state?: string };
      job?: unknown;
    };
    const raw = (data.printer?.state ?? "").toUpperCase();
    const state = mapPrusaState(raw);
    return {
      state,
      bedOccupied: state === "FINISHED" || state === "PRINTING" || state === "PAUSED",
      activeJobName: data.job ? "job" : undefined,
    };
  }

  async uploadJob(file: UploadFile, opts?: UploadOptions): Promise<UploadResult> {
    // PrusaLink can print straight after upload via the Print-After-Upload
    // header; otherwise the file is just stored and started later.
    const path = `${this.storage}/${safeName(file.filename)}`;
    const res = await fetchTimeout(
      joinUrl(this.base, `/api/v1/files/${path}`),
      {
        method: "PUT",
        headers: this.headers({
          "Content-Type": "application/octet-stream",
          "Print-After-Upload": opts?.startAfterUpload ? "?1" : "?0",
          Overwrite: "?1",
        }),
        body: new Uint8Array(file.buffer),
      },
      20000
    );
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`PrusaLink Upload ${res.status}`);
    }
    return { providerRef: path };
  }

  async startPrint(providerRef: string): Promise<void> {
    const res = await fetchTimeout(
      joinUrl(this.base, `/api/v1/files/${providerRef}`),
      { method: "POST", headers: this.headers() }
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`PrusaLink Start ${res.status}`);
    }
  }

  async cancel(_providerRef: string): Promise<void> {
    // Resolve the running job id, then stop it. Best-effort.
    const statusRes = await fetchTimeout(joinUrl(this.base, "/api/v1/status"), {
      headers: this.headers(),
    });
    if (!statusRes.ok) return;
    const data = (await statusRes.json()) as { job?: { id?: number } };
    const jobId = data.job?.id;
    if (jobId == null) return;
    await fetchTimeout(joinUrl(this.base, `/api/v1/job/${jobId}`), {
      method: "DELETE",
      headers: this.headers(),
    });
  }
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mapPrusaState(raw: string): PrinterState {
  switch (raw) {
    case "IDLE":
    case "READY":
      return raw as PrinterState;
    case "PRINTING":
    case "BUSY":
      return "PRINTING";
    case "PAUSED":
      return "PAUSED";
    case "FINISHED":
      return "FINISHED";
    case "STOPPED":
    case "ERROR":
    case "ATTENTION":
      return "ERROR";
    default:
      return "OFFLINE";
  }
}
