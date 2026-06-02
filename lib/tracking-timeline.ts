// Single source of truth for the customer-facing tracking timeline.
//
// The public tracking page (`/track/[token]`) renders the order's audit log as
// a "Verlauf". Most audit actions are internal (team assignment, jobs, internal
// comments, part phase moves, price changes, gate overrides) and must NEVER reach
// the customer's browser. Only the curated actions below are ever customer-visible,
// and each can be toggled individually in Settings → Kundenverlauf.
//
// This module is pure data (no React imports) so it can be used both server-side
// (filtering in app/api/orders/[token]/route.ts) and client-side (Settings UI).

export type TimelineGroup = "status" | "files" | "approvals" | "billing" | "survey";

export interface TimelineEventDef {
  /** Matches AuditLog.action */
  action: string;
  group: TimelineGroup;
  /** Default visibility when no explicit setting exists. Billing events default off. */
  defaultVisible: boolean;
  /** lucide-react icon name, mapped to a component client-side. */
  icon: string;
  /** i18n key in the `track` namespace. */
  labelKey: string;
}

// Ordered: newest-first rendering is handled by the caller, this is the
// canonical declaration order used for the Settings UI.
export const TIMELINE_EVENTS: TimelineEventDef[] = [
  { action: "ORDER_CREATED",      group: "status",    defaultVisible: true,  icon: "PackagePlus",      labelKey: "audit_submitted" },
  { action: "PHASE_CHANGED",      group: "status",    defaultVisible: true,  icon: "ArrowRightCircle", labelKey: "audit_phase_changed" },
  { action: "TEAM_FILE_UPLOADED", group: "files",     defaultVisible: true,  icon: "FileUp",           labelKey: "audit_team_file_uploaded" },
  { action: "FILE_UPLOADED",      group: "files",     defaultVisible: true,  icon: "Upload",           labelKey: "audit_file_uploaded" },
  { action: "DESIGN_REVIEW_SENT", group: "approvals", defaultVisible: true,  icon: "ShieldQuestion",   labelKey: "audit_design_review_sent" },
  { action: "VERIFICATION_SENT",  group: "approvals", defaultVisible: true,  icon: "ShieldQuestion",   labelKey: "audit_verification_sent" },
  { action: "PART_APPROVED",         group: "approvals", defaultVisible: true,  icon: "ShieldCheck", labelKey: "audit_verification_approved" },
  { action: "VERIFICATION_APPROVED", group: "approvals", defaultVisible: true,  icon: "ShieldCheck", labelKey: "audit_verification_approved" },
  { action: "VERIFICATION_REJECTED", group: "approvals", defaultVisible: true,  icon: "XCircle",     labelKey: "audit_verification_rejected" },
  { action: "PART_VERIFIED",         group: "approvals", defaultVisible: true,  icon: "ShieldCheck", labelKey: "audit_part_verified" },
  { action: "QUOTE_SENT",         group: "billing",   defaultVisible: false, icon: "FileText",         labelKey: "audit_quote_sent" },
  { action: "INVOICE_ISSUED",     group: "billing",   defaultVisible: false, icon: "Receipt",          labelKey: "audit_invoice_issued" },
  { action: "PAYMENT_RECORDED",   group: "billing",   defaultVisible: false, icon: "CheckCircle2",     labelKey: "audit_payment_recorded" },
  { action: "INVOICE_CANCELLED",  group: "billing",   defaultVisible: false, icon: "XCircle",          labelKey: "audit_invoice_cancelled" },
  { action: "SURVEY_SENT",        group: "survey",    defaultVisible: true,  icon: "MessageSquare",    labelKey: "audit_survey_sent" },
  { action: "SURVEY_SUBMITTED",   group: "survey",    defaultVisible: true,  icon: "Star",             labelKey: "audit_survey_submitted" },
];

export const TIMELINE_GROUP_ORDER: TimelineGroup[] = ["status", "files", "approvals", "billing", "survey"];

const EVENT_BY_ACTION = new Map(TIMELINE_EVENTS.map((e) => [e.action, e]));

export function getTimelineEvent(action: string): TimelineEventDef | undefined {
  return EVENT_BY_ACTION.get(action);
}

/** Setting key for an individual event's visibility: `tracking_event_<ACTION>`. */
export function settingKey(action: string): string {
  return `tracking_event_${action}`;
}

/** Master toggle key — when "false", the whole timeline is hidden. */
export const MASTER_SETTING_KEY = "tracking_timeline_enabled";

/**
 * Resolve whether a single event is visible given the settings map and its default.
 */
export function isEventVisible(action: string, settings: Record<string, string>): boolean {
  const def = EVENT_BY_ACTION.get(action);
  if (!def) return false; // unknown / internal actions are never visible
  const v = settings[settingKey(action)];
  return v === undefined ? def.defaultVisible : v === "true";
}

/**
 * Server-side: the set of audit actions a customer may see, given persisted settings.
 * Internal actions are absent by construction. Returns an empty set if the master
 * toggle is off.
 */
export function visibleTrackingActions(settings: Record<string, string>): Set<string> {
  if (settings[MASTER_SETTING_KEY] === "false") return new Set();
  return new Set(
    TIMELINE_EVENTS.filter((e) => isEventVisible(e.action, settings)).map((e) => e.action)
  );
}
