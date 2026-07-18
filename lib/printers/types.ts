/**
 * Printer provider abstraction. Every physical-printer backend (Prusa Connect,
 * Ultimaker Digital Factory, or the in-process Mock used for tests/dev)
 * implements this interface. The rest of the app only ever talks to a
 * PrinterProvider — it never knows which vendor is behind it.
 */

export type PrinterState =
  | "IDLE" // ready, bed clear, no active job
  | "READY" // ready to accept a job (treated like IDLE for auto-start)
  | "PRINTING" // currently printing
  | "PAUSED" // paused mid-print
  | "FINISHED" // print done but part likely still on the bed
  | "ERROR" // printer reported an error / needs attention
  | "OFFLINE"; // unreachable

export interface PrinterStatus {
  state: PrinterState;
  /** True when a part is (likely) still on the build plate — blocks auto-start. */
  bedOccupied: boolean;
  /** Name of the job currently on the printer, if any. */
  activeJobName?: string;
}

export interface UploadFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface UploadResult {
  /** Identifier the printer/cloud assigned to the uploaded job. */
  providerRef: string;
}

export interface UploadOptions {
  /**
   * Start (or queue-to-print) the job as part of the upload. Some backends
   * (Prusa Connect) have no separate start endpoint — the print intent must be
   * declared at upload time — so the start decision is passed down here.
   */
  startAfterUpload?: boolean;
}

/** Config decrypted from Machine.connectionConfigEnc. */
export interface PrinterConnectionConfig {
  token?: string;
  printerId?: string;
  baseUrl?: string;
  /** Mock-only: forces the state the MockProvider reports. */
  mockState?: PrinterState;
}

export interface PrinterProvider {
  /** One-shot status read used both for auto-start gating and the live badge. */
  getPrinterStatus(): Promise<PrinterStatus>;
  /**
   * Upload a sliced file. When opts.startAfterUpload is true the job is also
   * started/queued for print in the same operation; otherwise it is only stored.
   */
  uploadJob(file: UploadFile, opts?: UploadOptions): Promise<UploadResult>;
  /** Start a previously stored job (used for the manual "start now" on a hold). */
  startPrint(providerRef: string): Promise<void>;
  /** Cancel an uploaded/running job. */
  cancel(providerRef: string): Promise<void>;
}

/** A printer state that permits auto-start (idle + bed clear). */
export function isAutoStartAllowed(status: PrinterStatus): boolean {
  return (
    (status.state === "IDLE" || status.state === "READY") && !status.bedOccupied
  );
}
