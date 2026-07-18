import { decryptSecret, encryptSecret } from "@/lib/crypto-secret";
import { MockProvider } from "./mock";
import { PrusaLinkProvider } from "./prusalink";
import { PrusaConnectProvider } from "./prusa-connect";
import { UltimakerCloudProvider } from "./ultimaker-cloud";
import { getProfile, type PrinterProfile } from "./registry";
import type { PrinterConnectionConfig, PrinterProvider } from "./types";

export * from "./types";
export * from "./registry";

/** The subset of a Machine row the provider factory needs. */
export interface MachineConnection {
  connectionType: string; // PrinterConnectionType
  printerProfile: string | null;
  connectionConfigEnc: string | null;
}

/** True when the machine is wired to a real/mock printer backend. */
export function isConnected(machine: MachineConnection): boolean {
  return machine.connectionType !== "NONE";
}

export function decodeConnectionConfig(
  machine: MachineConnection
): PrinterConnectionConfig {
  if (!machine.connectionConfigEnc) return {};
  try {
    return JSON.parse(decryptSecret(machine.connectionConfigEnc));
  } catch {
    return {};
  }
}

/** Encrypt a connection config for storage in Machine.connectionConfigEnc. */
export function encodeConnectionConfig(
  config: PrinterConnectionConfig
): string {
  return encryptSecret(JSON.stringify(config));
}

/**
 * Strip the encrypted config from a machine row before sending it to the client
 * and expose only non-secret connection metadata (never the token itself).
 */
export function toPublicMachine<T extends MachineConnection>(machine: T) {
  const { connectionConfigEnc: _enc, ...rest } = machine;
  const config = decodeConnectionConfig(machine);
  const profile = getProfile(machine.printerProfile);
  return {
    ...rest,
    connected: isConnected(machine),
    connection: {
      type: machine.connectionType,
      profile: machine.printerProfile,
      vendor: profile?.vendor ?? null,
      model: profile?.model ?? null,
      printerId: config.printerId ?? null,
      baseUrl: config.baseUrl ?? null,
      mockState: config.mockState ?? null,
      hasToken: Boolean(config.token),
    },
  };
}

/**
 * Build the provider for a machine, keyed on its profile's transport. Throws if
 * the machine has no connection — callers should check isConnected() first.
 */
export function getProvider(machine: MachineConnection): PrinterProvider {
  const config = decodeConnectionConfig(machine);
  const profile = getProfile(machine.printerProfile);
  const transport = profile?.transport ?? transportFromLegacyType(machine.connectionType);

  switch (transport) {
    case "mock":
      return new MockProvider(config);
    case "prusalink":
      return new PrusaLinkProvider(config, profile);
    case "prusa-connect":
      return new PrusaConnectProvider(config, profile);
    case "ultimaker-cloud":
      return new UltimakerCloudProvider(config, profile);
    default:
      throw new Error("Machine has no printer connection configured");
  }
}

/** Fallback for rows that only have connectionType (e.g. bare MOCK/NONE). */
function transportFromLegacyType(connectionType: string): PrinterProfile["transport"] | null {
  switch (connectionType) {
    case "MOCK":
      return "mock";
    case "PRUSALINK":
      return "prusalink";
    case "PRUSA_CONNECT":
      return "prusa-connect";
    case "ULTIMAKER_CLOUD":
      return "ultimaker-cloud";
    default:
      return null;
  }
}
