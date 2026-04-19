import { prisma } from "@/lib/db/prisma";
import { AuditAction, OrgStatus, Prisma } from "@/generated/prisma/client";

const SYSTEM_ACTOR = "system";

/** Grace period before a PAST_DUE org is cancelled (28 days). */
const PAST_DUE_GRACE_DAYS = 28;

async function emitAudit(
  organizationId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      organizationId,
      actorUserId: SYSTEM_ACTOR,
      action,
      resourceType,
      resourceId,
      before: before as unknown as Prisma.InputJsonValue,
      after: after as unknown as Prisma.InputJsonValue,
    },
  });
}

function activityPurgeAfter(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}

async function emitActivity(
  organizationId: string,
  verb: string,
  objectType: string,
  objectId: string
): Promise<void> {
  await prisma.activityEvent.create({
    data: {
      organizationId,
      actorUserId: SYSTEM_ACTOR,
      verb,
      objectType,
      objectId,
      purgeAfter: activityPurgeAfter(),
    },
  });
}

/**
 * Finds all TRIALING orgs whose trial has expired (trialEndsAt < now())
 * and transitions them to TRIAL_EXPIRED.
 * Uses a catch-up query (< now()) — safe to run multiple times.
 */
export async function checkTrialExpiry(): Promise<void> {
  const now = new Date();

  const expiredSubs = await prisma.orgSubscription.findMany({
    where: {
      trialEndsAt: { lt: now },
      organization: { status: OrgStatus.TRIALING },
    },
    select: {
      organizationId: true,
      stripeSubscriptionId: true,
      organization: { select: { status: true } },
    },
  });

  for (const sub of expiredSubs) {
    if (sub.organization.status !== OrgStatus.TRIALING) continue;

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: sub.organizationId },
        data: { status: OrgStatus.TRIAL_EXPIRED },
      });
      await tx.orgSubscription.update({
        where: { organizationId: sub.organizationId },
        data: { status: "past_due" },
      });
    });

    await emitAudit(
      sub.organizationId,
      AuditAction.SUBSCRIPTION_TRIAL_EXPIRED,
      "OrgSubscription",
      sub.stripeSubscriptionId,
      { status: OrgStatus.TRIALING },
      { status: OrgStatus.TRIAL_EXPIRED }
    );
    await emitActivity(
      sub.organizationId,
      "SUBSCRIPTION_TRIAL_EXPIRED",
      "OrgSubscription",
      sub.stripeSubscriptionId
    );
  }
}

/**
 * Finds all PAST_DUE orgs that have exceeded the grace period and cancels them.
 * Uses Organization.updatedAt as a proxy for PAST_DUE entry time.
 * Uses a catch-up query (< now()) — safe to run multiple times.
 */
export async function checkPastDueExpiry(): Promise<void> {
  const graceCutoff = new Date();
  graceCutoff.setDate(graceCutoff.getDate() - PAST_DUE_GRACE_DAYS);

  const pastDueOrgs = await prisma.organization.findMany({
    where: {
      status: OrgStatus.PAST_DUE,
      updatedAt: { lt: graceCutoff },
    },
    select: {
      id: true,
      status: true,
      subscription: { select: { stripeSubscriptionId: true } },
    },
  });

  for (const org of pastDueOrgs) {
    if (!org.subscription) continue;

    await prisma.organization.update({
      where: { id: org.id },
      data: { status: OrgStatus.CANCELLED },
    });

    await emitAudit(
      org.id,
      AuditAction.SUBSCRIPTION_CANCELLED,
      "OrgSubscription",
      org.subscription.stripeSubscriptionId,
      { status: OrgStatus.PAST_DUE },
      { status: OrgStatus.CANCELLED }
    );
    await emitActivity(
      org.id,
      "SUBSCRIPTION_CANCELLED",
      "OrgSubscription",
      org.subscription.stripeSubscriptionId
    );
  }
}
