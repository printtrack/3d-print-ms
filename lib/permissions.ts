// Single source of truth for what a team role may do ("Rollen & Rechte").
//
// Admins define their own roles (e.g. "Schüler", "Betreuer") and tick the
// permissions below. ADMIN itself is not a TeamRole — it bypasses every check
// (see lib/authz.ts), which is what makes a misconfigured role unable to lock
// anyone out.
//
// Two orthogonal axes, do not conflate them:
//   * permission — may this actor do this KIND of action at all?
//   * restricted — may they only do it on objects they are ASSIGNED to?
//
// `scoped` decides whether the restriction can apply. Orders/projects/jobs have
// assignees, so a restricted member is limited to their own. The knowledge base
// and inventory have no assignment concept at all, so restriction is meaningless
// there and only the permission bit counts — to stop a student from deleting
// wiki entries you untick `knowledge.delete`.
//
// This module is deliberately free of prisma/next imports: RoleManager.tsx is a
// client component and needs PERMISSIONS as a *value* to render its matrix.
// The server-side guards live in lib/authz.ts.

import type { FeatureKey } from "@/lib/features";

/**
 * The seeded default role. A fixed id (rather than a cuid) so the migration,
 * prisma/seed.ts and the test seed all mean the same row and stay idempotent.
 */
export const SYSTEM_ROLE_ID = "teamrole_system_member";
export const SYSTEM_ROLE_NAME = "Team-Mitglied";

export type PermissionKey =
  | "orders.create"
  | "orders.edit"
  | "orders.assign"
  | "orders.archive"
  | "orders.reject"
  | "orders.delete"
  | "billing.quotes.manage"
  | "billing.invoices.manage"
  | "billing.payments.record"
  | "jobs.manage"
  | "jobs.verify"
  | "jobs.delete"
  | "projects.create"
  | "projects.edit"
  | "projects.delete"
  | "knowledge.create"
  | "knowledge.edit"
  | "knowledge.delete"
  | "inventory.edit"
  | "inventory.delete"
  | "landing.edit";

export type PermissionGroup =
  | "orders"
  | "billing"
  | "jobs"
  | "projects"
  | "knowledge"
  | "inventory"
  | "landing";

export interface PermissionDef {
  key: PermissionKey;
  group: PermissionGroup;
  /**
   * Whether the assignment restriction applies to this permission.
   * false = the object has no assignees; the permission bit alone decides.
   */
  scoped: boolean;
  /** Hidden in the role editor while the module is switched off. */
  feature?: FeatureKey;
  /** Destructive — highlighted in the editor. */
  dangerous?: boolean;
}

// Declaration order = order shown in the role editor.
export const PERMISSIONS: PermissionDef[] = [
  { key: "orders.create", group: "orders", scoped: false },
  { key: "orders.edit", group: "orders", scoped: true },
  { key: "orders.assign", group: "orders", scoped: true },
  { key: "orders.archive", group: "orders", scoped: true },
  { key: "orders.reject", group: "orders", scoped: true },
  { key: "orders.delete", group: "orders", scoped: true, dangerous: true },

  { key: "billing.quotes.manage", group: "billing", scoped: true, feature: "quotes" },
  { key: "billing.invoices.manage", group: "billing", scoped: true, feature: "invoices" },
  // Recording a payment only. Deleting one stays ADMIN-only, as it is today —
  // turning it into a permission would loosen the current rules, not tighten them.
  { key: "billing.payments.record", group: "billing", scoped: true, feature: "invoices" },

  { key: "jobs.manage", group: "jobs", scoped: true, feature: "jobs" },
  { key: "jobs.verify", group: "jobs", scoped: true, feature: "jobs" },
  { key: "jobs.delete", group: "jobs", scoped: true, feature: "jobs", dangerous: true },

  { key: "projects.create", group: "projects", scoped: false, feature: "projects" },
  { key: "projects.edit", group: "projects", scoped: true, feature: "projects" },
  { key: "projects.delete", group: "projects", scoped: true, feature: "projects", dangerous: true },

  { key: "knowledge.create", group: "knowledge", scoped: false, feature: "knowledge" },
  { key: "knowledge.edit", group: "knowledge", scoped: false, feature: "knowledge" },
  { key: "knowledge.delete", group: "knowledge", scoped: false, feature: "knowledge", dangerous: true },

  { key: "inventory.edit", group: "inventory", scoped: false, feature: "inventory" },
  { key: "inventory.delete", group: "inventory", scoped: false, feature: "inventory", dangerous: true },

  // The landing page has no assignees, and editing it is one capability: a block
  // is not worth its own create/edit/delete triple. Everyone may look at the
  // editor; only this bit lets them save.
  { key: "landing.edit", group: "landing", scoped: false },
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  "orders",
  "billing",
  "jobs",
  "projects",
  "knowledge",
  "inventory",
  "landing",
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as [
  PermissionKey,
  ...PermissionKey[],
];

const BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

export function isPermissionKey(key: string): key is PermissionKey {
  return BY_KEY.has(key as PermissionKey);
}

/** Whether the assignment restriction can apply to this permission. */
export function isScopedKey(key: PermissionKey): boolean {
  return BY_KEY.get(key)?.scoped ?? false;
}

export function permissionsForGroup(group: PermissionGroup): PermissionDef[] {
  return PERMISSIONS.filter((p) => p.group === group);
}

/**
 * What the seeded "Team-Mitglied" system role carries — and therefore what every
 * existing member gets on migration day.
 *
 * This list is NOT "everything harmless": it mirrors, key by key, what a
 * TEAM_MEMBER could already do before roles existed, so introducing the role
 * system changes nobody's access. Anything absent here was ADMIN-only before
 * (orders.delete, knowledge.delete, inventory.*) and stays that way until an
 * admin deliberately ticks it. Anything present here was open before — removing
 * it from this list would be a silent tightening that breaks working setups.
 *
 * Keep in sync with the guards: a key added here must be one TEAM_MEMBER really
 * had.
 */
export const DEFAULT_ROLE_PERMISSIONS: PermissionKey[] = [
  "orders.create",
  "orders.edit",
  "orders.assign",
  "orders.archive",
  "orders.reject",
  "billing.quotes.manage",
  "billing.invoices.manage",
  "billing.payments.record",
  "jobs.manage",
  "jobs.verify",
  "jobs.delete",
  "projects.create",
  "projects.edit",
  "projects.delete",
  "knowledge.create",
  "knowledge.edit",
];
