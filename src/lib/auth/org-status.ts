import { prisma } from "@/lib/db/prisma";
import type { OrgContext } from "@/lib/auth/types";
import { OrgInactiveError } from "@/lib/errors";

const ACTIVE_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"] as const;

/**
 * Throws OrgInactiveError if the organization is suspended, cancelled, or expired.
 */
export async function requireOrgActive(ctx: OrgContext): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { status: true, deletedAt: true },
  });

  if (
    !org ||
    org.deletedAt !== null ||
    !ACTIVE_STATUSES.includes(org.status as (typeof ACTIVE_STATUSES)[number])
  ) {
    throw new OrgInactiveError({
      status: org?.status ?? "SUSPENDED",
      organizationId: ctx.organizationId,
    });
  }
}
