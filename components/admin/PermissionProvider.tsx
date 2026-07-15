"use client";

import { createContext, useContext, useMemo } from "react";
import type { PermissionKey } from "@/lib/permissions";

/**
 * The signed-in user's rights, for UI gating.
 *
 * This is a HINT, never a guard: every button hidden here has a server-side
 * check behind it (lib/authz.ts). Hiding is about not offering what will fail,
 * not about security.
 */
export interface ActorInfo {
  id: string;
  isAdmin: boolean;
  restricted: boolean;
  permissions: string[];
}

const PermissionContext = createContext<ActorInfo | null>(null);

export function PermissionProvider({
  actor,
  children,
}: {
  actor: ActorInfo | null;
  children: React.ReactNode;
}) {
  return (
    <PermissionContext.Provider value={actor}>{children}</PermissionContext.Provider>
  );
}

export function usePermissions() {
  const actor = useContext(PermissionContext);

  return useMemo(() => {
    const set = new Set(actor?.permissions ?? []);
    return {
      actor,
      isAdmin: actor?.isAdmin ?? false,
      restricted: actor?.restricted ?? false,
      /** Holds the permission, ignoring any assignment scope. */
      can: (key: PermissionKey) => (actor?.isAdmin ?? false) || set.has(key),
    };
  }, [actor]);
}

// Note: there is deliberately no client-side "may I edit THIS order?" hook.
// "Assigned" spans order, part and milestone-task assignees, and a client only
// ever holds the order-level list — it would lock out someone who is on a single
// part. Order-level rights come from canEditOrder() in lib/authz.ts, computed on
// the server and passed down as a prop.
