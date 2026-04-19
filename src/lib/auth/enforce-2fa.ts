import type { OrgContext, PlatformRole } from "@/lib/auth/types";

const ROLES_REQUIRING_2FA: PlatformRole[] = ["OWNER", "ADMIN"];

/**
 * Returns true if the user's role requires 2FA enrollment and they have not yet
 * set it up. The caller should redirect to the 2FA setup page when this is true.
 */
export function requires2FASetup(
  ctx: OrgContext,
  twoFactorEnabled: boolean
): boolean {
  return ROLES_REQUIRING_2FA.includes(ctx.role) && !twoFactorEnabled;
}
