import { prisma } from "@/lib/db/prisma";
import { AuditAction, OrgStatus, Prisma } from "@/generated/prisma/client";

const SYSTEM_ACTOR = "system";

// Fix #8: spec says 7-day grace before PAST_DUE → TRIAL_EXPIRED (was incorrectly 28)
const PAST_DUE_GRACE_DAYS = 7;

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
      // Fix #7: do not overwrite OrgSubscription.status here — Stripe status stays "trialing"
      // until Stripe cancels it. Diverging from Stripe's status breaks subsequent webhook processing.
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

    // Fix #8: spec says PAST_DUE → TRIAL_EXPIRED (not CANCELLED) after grace period
    await prisma.organization.update({
      where: { id: org.id },
      data: { status: OrgStatus.TRIAL_EXPIRED },
    });

    await emitAudit(
      org.id,
      AuditAction.SUBSCRIPTION_TRIAL_EXPIRED,
      "OrgSubscription",
      org.subscription.stripeSubscriptionId,
      { status: OrgStatus.PAST_DUE },
      { status: OrgStatus.TRIAL_EXPIRED, reason: "past_due_7d_grace_expired" }
    );
    await emitActivity(
      org.id,
      "SUBSCRIPTION_TRIAL_EXPIRED",
      "OrgSubscription",
      org.subscription.stripeSubscriptionId
    );
  }
}
