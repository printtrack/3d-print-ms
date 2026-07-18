/**
 * Printer registry — the single place that knows which vendors and models the
 * app can talk to. A machine points at a profile id; the profile decides the
 * transport (which adapter), the accepted file formats, and sensible defaults.
 *
 * Adding a new printer later = add one entry here (and, if it needs a transport
 * that doesn't exist yet, one adapter under lib/printers/). Nothing else in the
 * app hard-codes a vendor.
 */

export type PrinterTransport =
  | "mock"
  | "prusalink"
  | "prusa-connect"
  | "ultimaker-cloud";

export interface CredentialField {
  /** Key inside the encrypted connection config. */
  key: "token" | "printerId" | "baseUrl";
  /** i18n key suffix under admin.machine_conn_field_* for the label. */
  labelKey: string;
  required: boolean;
}

export interface PrinterProfile {
  /** Stable id stored on Machine.printerProfile, e.g. "prusa-core-one". */
  id: string;
  vendor: string;
  model: string;
  transport: PrinterTransport;
  /** Accepted upload file extensions (lowercase, with dot). */
  fileExtensions: string[];
  buildVolume?: { x: number; y: number; z: number };
  /** Which credential fields the connection editor should collect. */
  fields: CredentialField[];
  /** Default base URL for the transport (may be overridden per machine). */
  defaultBaseUrl?: string;
}

const PRUSALINK_FIELDS: CredentialField[] = [
  { key: "baseUrl", labelKey: "host", required: true },
  { key: "token", labelKey: "apikey", required: true },
];

// Prusa Connect (cloud) — same path OrcaSlicer/PrusaSlicer use to reach a Prusa
// printer from anywhere: just the per-printer Prusa Connect API key (X-Api-Key)
// against connect.prusa3d.com (OctoPrint-compatible upload API).
const PRUSA_CONNECT_FIELDS: CredentialField[] = [
  { key: "token", labelKey: "connectkey", required: true },
];

const ULTIMAKER_FIELDS: CredentialField[] = [
  { key: "token", labelKey: "token", required: true },
  { key: "printerId", labelKey: "cluster", required: true },
  { key: "baseUrl", labelKey: "baseurl", required: false },
];

export const PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "prusa-core-one",
    vendor: "Prusa",
    model: "CORE One (Connect/Cloud)",
    transport: "prusa-connect",
    // MK4/CORE-generation firmware prints binary G-code; plain gcode still works.
    fileExtensions: [".bgcode", ".gcode"],
    buildVolume: { x: 250, y: 220, z: 270 },
    fields: PRUSA_CONNECT_FIELDS,
    defaultBaseUrl: "https://connect.prusa3d.com",
  },
  {
    id: "prusa-core-one-local",
    vendor: "Prusa",
    model: "CORE One (PrusaLink/lokal)",
    transport: "prusalink",
    fileExtensions: [".bgcode", ".gcode"],
    buildVolume: { x: 250, y: 220, z: 270 },
    fields: PRUSALINK_FIELDS,
  },
  {
    id: "ultimaker-s3",
    vendor: "Ultimaker",
    model: "S3",
    transport: "ultimaker-cloud",
    fileExtensions: [".ufp", ".gcode", ".gcode.gz"],
    buildVolume: { x: 230, y: 190, z: 200 },
    fields: ULTIMAKER_FIELDS,
    defaultBaseUrl: "https://api.ultimaker.com",
  },
  {
    id: "mock",
    vendor: "Test",
    model: "Mock-Drucker",
    transport: "mock",
    fileExtensions: [".gcode", ".bgcode", ".3mf"],
    fields: [],
  },
];

export function getProfile(id: string | null | undefined): PrinterProfile | null {
  if (!id) return null;
  return PRINTER_PROFILES.find((p) => p.id === id) ?? null;
}

/** Map a profile id to the connectionType enum stored on the machine. */
export function transportToConnectionType(transport: PrinterTransport): string {
  switch (transport) {
    case "mock":
      return "MOCK";
    case "prusalink":
      return "PRUSALINK";
    case "prusa-connect":
      return "PRUSA_CONNECT";
    case "ultimaker-cloud":
      return "ULTIMAKER_CLOUD";
  }
}

/** Distinct vendors in registry order, for the vendor dropdown. */
export function listVendors(): string[] {
  return [...new Set(PRINTER_PROFILES.map((p) => p.vendor))];
}
