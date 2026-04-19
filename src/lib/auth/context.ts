import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import type { OrgContext, PlatformRole } from "@/lib/auth/types";
import {
  UnauthorizedError,
  ForbiddenError,
  NoActiveOrgError,
} from "@/lib/errors";

const ROLE_HIERARCHY: Record<PlatformRole, number> = {
  WORKER: 0,
  MANAGER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Retrieves the verified org context for the currently authenticated user.
 * Re-fetches membership on every call to catch revocations that occurred
 * after the session was issued.
 *
 * @throws UnauthorizedError if no session exists
 * @throws NoActiveOrgError if no organizationId in session or no active membership
 * @throws ForbiddenError if membership is revoked/suspended
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new NoActiveOrgError();
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId,
      },
    },
    select: {
      id: true,
      role: true,
      jobRoleId: true,
      status: true,
      organization: { select: { name: true } },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("Membership is not active");
  }

  return {
    userId: session.user.id,
    organizationId,
    role: membership.role as PlatformRole,
    jobRoleId: membership.jobRoleId ?? undefined,
    membershipId: membership.id,
    userEmail: session.user.email ?? "",
    orgName: membership.organization.name,
  };
}

/**
 * Asserts the caller's role is at least `min` in the hierarchy.
 * @throws ForbiddenError if the role is insufficient
 */
export function requireRole(min: PlatformRole, ctx: OrgContext): void {
  if (ROLE_HIERARCHY[ctx.role] < ROLE_HIERARCHY[min]) {
    throw new ForbiddenError(
      `Role ${ctx.role} does not meet minimum required role ${min}`
    );
  }
}

/**
 * Asserts the given userId is an active member of the given organization.
 * @throws ForbiddenError if not a member or not active
 */
export async function assertOrgMembership(
  userId: string,
  organizationId: string
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("User is not an active member of this organization");
  }
}
