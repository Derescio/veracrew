export type PlatformRole = "OWNER" | "ADMIN" | "MANAGER" | "WORKER";

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: PlatformRole;
  jobRoleId?: string;
  membershipId: string;
}

export interface VeracrewSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  organizationId: string;
  role: PlatformRole;
  membershipId: string;
  expires: string;
}
