// Who may place which kind of order, and who may get an account.
//
// Two independent questions a shop needs to answer:
//   1. Which order types are accepted per channel — "public" (no account,
//      landing-page form) vs. "portal" (signed-in customer). A shop that only
//      designs for known customers switches DESIGN off for the public channel
//      and leaves it on for the portal.
//   2. How customer accounts come into existence — open registration,
//      invite-only, or closed entirely.
//
// Both are stored in the key/value `Setting` store. Defaults reproduce the
// previous behaviour (everything allowed, registration open), so an untouched
// install is unaffected.
//
// The matrix is deliberately not validated into a "sensible" shape: an admin
// may switch every channel off (nobody can order) — the Settings UI warns about
// that rather than silently overriding the choice.

import { getSettings } from "@/lib/settings";

export type OrderTypeKey = "PRINT_ONLY" | "DESIGN";
export type IntakeChannel = "public" | "portal";
export type RegistrationMode = "open" | "invite" | "closed";

export const REGISTRATION_MODES: RegistrationMode[] = ["open", "invite", "closed"];

/** Invite lifetime; also the copy shown in the admin UI and the mail. */
export const INVITE_TTL_DAYS = 14;

export const INTAKE_SETTING_KEYS = {
  public: { PRINT_ONLY: "orders_public_print_enabled", DESIGN: "orders_public_design_enabled" },
  portal: { PRINT_ONLY: "orders_portal_print_enabled", DESIGN: "orders_portal_design_enabled" },
} as const satisfies Record<IntakeChannel, Record<OrderTypeKey, string>>;

export const REGISTRATION_MODE_KEY = "portal_registration_mode";

/** Superseded by the public-channel matrix; still honoured for installs that set it. */
const LEGACY_ORDERTYPE_VISIBLE_KEY = "orderform_field_ordertype_visible";

export interface OrderIntakeConfig {
  /** Order types this channel accepts, in stable UI order. May be empty. */
  allowedTypes: OrderTypeKey[];
  /** False when the channel accepts nothing at all. */
  enabled: boolean;
  /** Only one type left → the picker is pointless, submit that type implicitly. */
  singleType: OrderTypeKey | null;
}

function isTypeEnabled(
  settings: Record<string, string>,
  channel: IntakeChannel,
  type: OrderTypeKey,
): boolean {
  // An empty value counts as unset, not as "on": settings are cleared by writing
  // "" (updateSettings never stores empty), and a blank boolean means nothing.
  const explicit = settings[INTAKE_SETTING_KEYS[channel][type]]?.trim();
  if (explicit) return explicit !== "false";

  // Back-compat: hiding the order-type field used to force every public order to
  // PRINT_ONLY, which is exactly "public DESIGN off" in the new model.
  if (channel === "public" && type === "DESIGN" && settings[LEGACY_ORDERTYPE_VISIBLE_KEY] === "false") {
    return false;
  }
  return true;
}

export function buildOrderIntakeConfig(
  settings: Record<string, string>,
  channel: IntakeChannel,
): OrderIntakeConfig {
  const allowedTypes = (["PRINT_ONLY", "DESIGN"] as const).filter((t) =>
    isTypeEnabled(settings, channel, t),
  );
  return {
    allowedTypes,
    enabled: allowedTypes.length > 0,
    singleType: allowedTypes.length === 1 ? allowedTypes[0] : null,
  };
}

export async function getOrderIntakeConfig(channel: IntakeChannel): Promise<OrderIntakeConfig> {
  return buildOrderIntakeConfig(await getSettings(), channel);
}

export function buildRegistrationMode(settings: Record<string, string>): RegistrationMode {
  const raw = settings[REGISTRATION_MODE_KEY];
  return (REGISTRATION_MODES as string[]).includes(raw) ? (raw as RegistrationMode) : "open";
}

export async function getRegistrationMode(): Promise<RegistrationMode> {
  return buildRegistrationMode(await getSettings());
}
