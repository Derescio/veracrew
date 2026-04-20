import type { PlatformRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    // Fix #18: nullable — users without an active membership have no org context;
    // requireOrgContext() validates and throws before any downstream use.
    organizationId: string | null;
    role: PlatformRole | null;
    membershipId: string | null;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    // Fix #18: these fields are only populated when an active membership exists
    organizationId?: string | null;
    role?: PlatformRole | null;
    membershipId?: string | null;
  }
}
