// Module augmentation for Auth.js v5.
//
// Without this, `session.user.role` does not exist on next-auth's default `User`
// type and every call site needs a `(session.user as { role?: string }).role`
// cast. The JWT callback in lib/auth.ts puts `id`, `role` and `locale` on the
// token; this file makes that contract visible to TypeScript.
//
// Note: `session.user.role` reflects the role at sign-in time. Authorization
// decisions must use `getActor()` from lib/authz.ts, which reads the current
// role from the database — see the comment there.

import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role?: Role;
    locale?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: Role;
      locale?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    locale?: string;
  }
}
