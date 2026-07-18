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
 * Ultimaker S3 (and other Digital-Factory-connected printers) via the
 * **Ultimaker Digital Factory / Cloud API** (https://api.ultimaker.com). This
 * is a real cloud API, so it works from an external server as long as the
 * printer is linked to the account's Digital Factory.
 *
 * Auth: OAuth2 bearer token in `config.token`. `config.printerId` is the
 * cluster id (the S3 shows up as a single-printer cluster). Base URL defaults to
 * https://api.ultimaker.com (overridable via `config.baseUrl`).
 *
 * Flow (docs: https://docs.api.ultimaker.com/):
 *   status  → GET  /connect/v1/clusters/{clusterId}/status
 *   upload  → POST /cura/v1/jobs/upload  (get upload_url + job_id)
 *             then PUT the file bytes to upload_url
 *   start   → POST /connect/v1/clusters/{clusterId}/print_jobs  { job_id }
 *   cancel  → DELETE /connect/v1/clusters/{clusterId}/print_jobs/{ref}
 *
 * NOTE: remote print submission may require a Digital Factory subscription, and
 * this adapter is not yet validated against a live account — verify before
 * production use. Failures surface as a FAILED dispatch with the message.
 */
export class UltimakerCloudProvider implements PrinterProvider {
  private readonly base: string;
  private readonly token: string;
  private readonly clusterId: string;

  constructor(config: PrinterConnectionConfig, profile: PrinterProfile | null) {
    if (!config.token) throw new Error("Ultimaker: Token fehlt");
    if (!config.printerId) throw new Error("Ultimaker: Cluster-ID fehlt");
    this.token = config.token;
    this.clusterId = config.printerId;
    this.base = config.baseUrl || profile?.defaultBaseUrl || "https://api.ultimaker.com";
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  async getPrinterStatus(): Promise<PrinterStatus> {
    const res = await fetchTimeout(
      joinUrl(this.base, `/connect/v1/clusters/${this.clusterId}/status`),
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Ultimaker Status ${res.status}`);
    const data = (await res.json()) as {
      printers?: Array<{ status?: string }>;
      print_jobs?: Array<{ name?: string; status?: string }>;
    };
    const printerStatus = (data.printers?.[0]?.status ?? "").toLowerCase();
    const activeJob = data.print_jobs?.find(
      (j) => j.status === "printing" || j.status === "active"
    );
    const state = mapUltimakerState(printerStatus, Boolean(activeJob));
    return {
      state,
      bedOccupied: state === "PRINTING" || state === "PAUSED" || Boolean(activeJob),
      activeJobName: activeJob?.name,
    };
  }

  async uploadJob(file: UploadFile, opts?: UploadOptions): Promise<UploadResult> {
    // 1) Request an upload location + job id.
    const initRes = await fetchTimeout(
      joinUrl(this.base, "/cura/v1/jobs/upload"),
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          job_name: file.filename,
          file_size: file.buffer.length,
          content_type: file.mimeType || "application/octet-stream",
        }),
      }
    );
    if (!initRes.ok) throw new Error(`Ultimaker Upload-Init ${initRes.status}`);
    const init = (await initRes.json()) as {
      data?: { upload_url?: string; job_id?: string };
    };
    const uploadUrl = init.data?.upload_url;
    const jobId = init.data?.job_id;
    if (!uploadUrl || !jobId) throw new Error("Ultimaker: unerwartete Upload-Antwort");

    // 2) PUT the file bytes to the signed upload URL (no auth header — the URL
    //    is pre-signed).
    const putRes = await fetchTimeout(
      uploadUrl,
      {
        method: "PUT",
        headers: { "Content-Type": file.mimeType || "application/octet-stream" },
        body: new Uint8Array(file.buffer),
      },
      30000
    );
    if (!putRes.ok) throw new Error(`Ultimaker Upload ${putRes.status}`);

    // Submit to the cluster right away when starting; otherwise leave it in the
    // library and let startPrint() submit it later (manual "start now").
    if (opts?.startAfterUpload) {
      await this.startPrint(jobId);
    }
    return { providerRef: jobId };
  }

  async startPrint(providerRef: string): Promise<void> {
    const res = await fetchTimeout(
      joinUrl(this.base, `/connect/v1/clusters/${this.clusterId}/print_jobs`),
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ job_id: providerRef }),
      }
    );
    if (!res.ok) throw new Error(`Ultimaker Start ${res.status}`);
  }

  async cancel(providerRef: string): Promise<void> {
    await fetchTimeout(
      joinUrl(
        this.base,
        `/connect/v1/clusters/${this.clusterId}/print_jobs/${providerRef}`
      ),
      { method: "DELETE", headers: this.headers() }
    );
  }
}

function mapUltimakerState(status: string, hasActiveJob: boolean): PrinterState {
  switch (status) {
    case "idle":
      return hasActiveJob ? "PRINTING" : "IDLE";
    case "printing":
    case "pre_print":
    case "post_print":
      return "PRINTING";
    case "paused":
      return "PAUSED";
    case "maintenance":
    case "error":
      return "ERROR";
    case "":
      return "OFFLINE";
    default:
      return hasActiveJob ? "PRINTING" : "IDLE";
  }
}
