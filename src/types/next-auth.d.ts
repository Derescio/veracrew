import type { PlatformRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    organizationId: string;
    role: PlatformRole;
    membershipId: string;
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
    organizationId: string;
    role: PlatformRole;
    membershipId: string;
  }
}
