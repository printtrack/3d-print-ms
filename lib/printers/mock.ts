import { randomUUID } from "crypto";
import type {
  PrinterConnectionConfig,
  PrinterProvider,
  PrinterStatus,
  UploadFile,
  UploadOptions,
  UploadResult,
} from "./types";

/**
 * In-process printer used for local development and E2E tests. It reports the
 * state given in the machine's connection config (`mockState`), so tests can
 * deterministically exercise the auto-start-when-idle path vs. the HELD path
 * without touching the network.
 *
 * Default state is IDLE, so a freshly configured MOCK machine auto-starts.
 */
export class MockProvider implements PrinterProvider {
  constructor(private readonly config: PrinterConnectionConfig) {}

  async getPrinterStatus(): Promise<PrinterStatus> {
    const state = this.config.mockState ?? "IDLE";
    return {
      state,
      // A finished-but-not-cleared print or an active print means the bed is busy.
      bedOccupied: state === "FINISHED" || state === "PRINTING" || state === "PAUSED",
      activeJobName: state === "PRINTING" ? "mock-job" : undefined,
    };
  }

  async uploadJob(_file: UploadFile, _opts?: UploadOptions): Promise<UploadResult> {
    return { providerRef: `mock-${randomUUID()}` };
  }

  async startPrint(_providerRef: string): Promise<void> {
    // no-op: the mock printer "accepts" the start immediately
  }

  async cancel(_providerRef: string): Promise<void> {
    // no-op
  }
}
