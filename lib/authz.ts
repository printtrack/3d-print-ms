// Server-side authorization. Single source of truth for "who is asking and what
// may they do" — replaces the `isAdmin(session)` helper that used to be copied
// into every API route.
//
// Guards mirror `assertFeature` from lib/features.ts: they return a NextResponse
// to send, or null when the request may proceed.
//
//   const guard = await assertAdmin();
//   if (guard) return guard;
//
// This module is server-only (imports prisma + NextResponse). The client-safe
// permission registry lives in lib/permissions.ts.

import { cache } from "react";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isPermissionKey,
  isScopedKey,
  type PermissionKey,
} from "@/lib/permissions";
import { orderIdsOfJob } from "@/lib/authz-resolve";

export interface Actor {
  id: string;
  name: string;
  email: string;
  /** Bypasses every permission and the assignment restriction. */
  isAdmin: boolean;
  /** May only write objects they are assigned to (scoped permissions only). */
  restricted: boolean;
  permissions: Set<PermissionKey>;
}

/** Error codes the UI distinguishes: "your role can't" vs "not your order". */
export const FORBIDDEN_PERMISSION = "FORBIDDEN_PERMISSION";
export const FORBIDDEN_NOT_ASSIGNED = "FORBIDDEN_NOT_ASSIGNED";

/**
 * The current user, resolved from the database.
 *
 * The role deliberately comes from the DB row, not from `session.user.role`:
 * the JWT is signed at sign-in, so a token keeps whatever role it was minted
 * with until the user logs in again. Reading it live means an admin who revokes
 * someone's rights has them revoked on the very next request.
 *
 * Wrapped in React's `cache` so repeated calls within one request share a single
 * lookup. Returns null when signed out, or when the session points at a user who
 * no longer exists.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      restrictedToAssigned: true,
      teamRole: { include: { permissions: { select: { key: true } } } },
    },
  });
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  // A member whose role was deleted falls back to the default role rather than
  // to no rights at all: silently stripping someone of access is a worse failure
  // than briefly granting the baseline, and the fallback keeps a missed backfill
  // from looking like a random 403.
  const role =
    user.teamRole ??
    (isAdmin
      ? null
      : await prisma.teamRole.findFirst({
          where: { isDefault: true },
          include: { permissions: { select: { key: true } } },
        }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin,
    restricted: isAdmin
      ? false
      : (user.restrictedToAssigned ?? role?.restricted ?? false),
    permissions: new Set(
      (role?.permissions ?? [])
        .map((p) => p.key)
        .filter(isPermissionKey),
    ),
  };
});

/** Whether the actor holds a permission, ignoring any assignment restriction. */
export function can(actor: Actor | null, key: PermissionKey): boolean {
  if (!actor) return false;
  return actor.isAdmin || actor.permissions.has(key);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Guard for routes only an ADMIN may touch. */
export async function assertAdmin(): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (!actor.isAdmin) return forbidden();
  return null;
}

/** Guard for routes any signed-in team member may touch. */
export async function assertSignedIn(): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  return null;
}

function forbiddenPermission(key: PermissionKey): NextResponse {
  return NextResponse.json(
    { error: "Forbidden", code: FORBIDDEN_PERMISSION, permission: key },
    { status: 403 },
  );
}

function forbiddenNotAssigned(): NextResponse {
  return NextResponse.json(
    {
      error: "Du bist diesem Auftrag nicht zugewiesen.",
      code: FORBIDDEN_NOT_ASSIGNED,
    },
    { status: 403 },
  );
}

/**
 * Prisma predicate for "this order counts as mine".
 *
 * Mirrors the existing assignee filter in app/admin/orders/page.tsx, on purpose:
 * whatever the list shows me when I filter by myself is exactly what I may edit.
 * Being on a single part or milestone task is enough for the whole order — the
 * guard against wrecking other people's work is the orders.delete permission,
 * not a narrower scope.
 */
export function assignedOrderFilter(userId: string) {
  return {
    OR: [
      { assignees: { some: { userId } } },
      { parts: { some: { assignees: { some: { userId } } } } },
      { milestones: { some: { tasks: { some: { assignees: { some: { userId } } } } } } },
    ],
  };
}

async function isAssignedToOrder(userId: string, orderId: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { id: orderId, ...assignedOrderFilter(userId) },
  });
  return count > 0;
}

/**
 * May the current actor edit this order? Same rules as assertOrderAccess, as a
 * boolean for server components that need to render a read-only view.
 *
 * Deliberately computed on the server: "assigned" spans order, part and
 * milestone-task assignees, and a client only ever has the order-level list —
 * it would wrongly lock out someone who is on just one part.
 */
export async function canEditOrder(orderId: string): Promise<boolean> {
  const actor = await getActor();
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (!actor.permissions.has("orders.edit")) return false;
  if (!actor.restricted) return true;
  return isAssignedToOrder(actor.id, orderId);
}

/**
 * May the current actor reject this order? Mirrors canEditOrder but gates on
 * the orders.reject permission — computed server-side for the same reasons.
 */
export async function canRejectOrder(orderId: string): Promise<boolean> {
  const actor = await getActor();
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (!actor.permissions.has("orders.reject")) return false;
  if (!actor.restricted) return true;
  return isAssignedToOrder(actor.id, orderId);
}

/**
 * Guard for a permission that is not tied to an assignable object
 * (knowledge base, inventory). The restriction never applies here.
 */
export async function assertPermission(
  key: PermissionKey,
): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (actor.isAdmin) return null;
  if (!actor.permissions.has(key)) return forbiddenPermission(key);
  return null;
}

/**
 * Guard for an action on one specific order.
 * Admins pass straight through; the assignment lookup only runs for restricted
 * members, so everyone else pays nothing for it.
 */
export async function assertOrderAccess(
  orderId: string,
  key: PermissionKey,
): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (actor.isAdmin) return null;
  if (!actor.permissions.has(key)) return forbiddenPermission(key);
  if (!actor.restricted || !isScopedKey(key)) return null;

  if (!(await isAssignedToOrder(actor.id, orderId))) return forbiddenNotAssigned();
  return null;
}

/**
 * Guard for an action spanning several orders (a print job may hold parts from
 * many). Requires access to *every* one of them: "any" would let a student with
 * one part in a shared job mutate everyone else's parts in it.
 */
export async function assertOrderAccessMany(
  orderIds: string[],
  key: PermissionKey,
): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (actor.isAdmin) return null;
  if (!actor.permissions.has(key)) return forbiddenPermission(key);
  if (!actor.restricted || !isScopedKey(key)) return null;

  const unique = [...new Set(orderIds)];
  if (unique.length === 0) return null;

  const reachable = await prisma.order.count({
    where: { id: { in: unique }, ...assignedOrderFilter(actor.id) },
  });
  if (reachable < unique.length) return forbiddenNotAssigned();
  return null;
}

/**
 * Guard for something that hangs off an order XOR a project (milestones,
 * sprints, tasks). Dispatches to whichever scope it actually has.
 */
export async function assertOrderOrProjectAccess(
  scope: { orderId: string | null; projectId: string | null },
  keys: { order: PermissionKey; project: PermissionKey },
): Promise<NextResponse | null> {
  if (scope.orderId) return assertOrderAccess(scope.orderId, keys.order);
  if (scope.projectId) return assertProjectAccess(scope.projectId, keys.project);
  // Belongs to nothing — treat as an order-level edit rather than waving it through.
  return assertPermission(keys.order);
}

/**
 * Guard for a print job. A job may hold parts from several orders, so a
 * restricted member needs access to *every* order in it — with "any" a student
 * with one part in a shared job could mutate everyone else's parts. Being an
 * explicit PrintJobAssignee is the alternative, since that is an admin's
 * deliberate grant.
 */
export async function assertJobAccess(
  jobId: string,
  key: PermissionKey,
): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (actor.isAdmin) return null;
  if (!actor.permissions.has(key)) return forbiddenPermission(key);
  if (!actor.restricted || !isScopedKey(key)) return null;

  const assigned = await prisma.printJobAssignee.count({
    where: { printJobId: jobId, userId: actor.id },
  });
  if (assigned > 0) return null;

  const orderIds = await orderIdsOfJob(jobId);
  if (orderIds.length === 0) return null;

  const reachable = await prisma.order.count({
    where: { id: { in: orderIds }, ...assignedOrderFilter(actor.id) },
  });
  if (reachable < orderIds.length) return forbiddenNotAssigned();
  return null;
}

/** Guard for an action on one project (ProjectAssignee decides). */
export async function assertProjectAccess(
  projectId: string,
  key: PermissionKey,
): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (actor.isAdmin) return null;
  if (!actor.permissions.has(key)) return forbiddenPermission(key);
  if (!actor.restricted || !isScopedKey(key)) return null;

  const count = await prisma.project.count({
    where: { id: projectId, assignees: { some: { userId: actor.id } } },
  });
  if (count === 0) return forbiddenNotAssigned();
  return null;
}
