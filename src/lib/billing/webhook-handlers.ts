import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { AuditAction, OrgStatus, PlanKey, Prisma } from "@/generated/prisma/client";
import { resolvePlanKey } from "@/lib/billing/plan-mapping";

// Fix #10: structural interface satisfied by both the regular prisma client and an
// interactive transaction client (tx), enabling audit/activity emits inside transactions.
interface EmitClient {
  auditEvent: Pick<typeof prisma.auditEvent, "create">;
  activityEvent: Pick<typeof prisma.activityEvent, "create">;
}

/** Sentinel actor ID used for all system-initiated audit/activity events. */
const SYSTEM_ACTOR = "system";

/** Default activity event retention: 90 days */
const ACTIVITY_TTL_DAYS = 90;

function activityPurgeAfter(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ACTIVITY_TTL_DAYS);
  return d;
}

async function emitAuditEvent(
  client: EmitClient,
  organizationId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>
): Promise<void> {
  await client.auditEvent.create({
    data: {
      organizationId,
      actorUserId: SYSTEM_ACTOR,
      action,
      resourceType,
      resourceId,
      before: before ? (before as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      after: after ? (after as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

async function emitActivityEvent(
  client: EmitClient,
  organizationId: string,
  verb: string,
  objectType: string,
  objectId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await client.activityEvent.create({
    data: {
      organizationId,
      actorUserId: SYSTEM_ACTOR,
      verb,
      objectType,
      objectId,
      metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      purgeAfter: activityPurgeAfter(),
    },
  });
}

// ─── Subscription Created ────────────────────────────────────────────────────

async function handleSubscriptionCreated(sub: Stripe.Subscription): Promise<void> {
  const customerId = sub.customer as string;
  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, status: true },
  });
  if (!org) {
    throw new Error(`No org found for Stripe customer ${customerId}`);
  }

  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planKey: PlanKey = resolvePlanKey(priceId);
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const itemPeriodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = new Date((itemPeriodEnd ?? sub.billing_cycle_anchor) * 1000);
  const hasPaymentMethod = sub.default_payment_method !== null;
  const seatCount = sub.items.data[0]?.quantity ?? 1;

  const prevStatus = org.status;
  // Fix #6: map sub.status → OrgStatus so skip-trial ACTIVE subscriptions are handled correctly
  const newOrgStatus = sub.status === "active" ? OrgStatus.ACTIVE : OrgStatus.TRIALING;
  const auditAction =
    newOrgStatus === OrgStatus.ACTIVE
      ? AuditAction.SUBSCRIPTION_ACTIVATED
      : AuditAction.SUBSCRIPTION_TRIAL_STARTED;
  const activityVerb =
    newOrgStatus === OrgStatus.ACTIVE ? "SUBSCRIPTION_ACTIVATED" : "SUBSCRIPTION_TRIAL_STARTED";

  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        planKey,
        status: sub.status,
        trialEndsAt,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        hasPaymentMethod,
        requiresPaymentAction: false,
        seatCount,
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        planKey,
        status: sub.status,
        trialEndsAt,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        hasPaymentMethod,
        requiresPaymentAction: false,
        seatCount,
      },
    });

    await tx.organization.update({
      where: { id: org.id },
      data: { status: newOrgStatus },
    });

    // Fix #10: audit/activity inside the transaction so status change and audit trail are atomic
    await emitAuditEvent(tx, org.id, auditAction, "OrgSubscription", sub.id,
      { status: prevStatus }, { status: newOrgStatus });
    await emitActivityEvent(tx, org.id, activityVerb, "OrgSubscription", sub.id);
  });
}

// ─── Subscription Updated ────────────────────────────────────────────────────

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.orgSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: {
      organizationId: true,
      status: true,
      hasPaymentMethod: true,
      organization: { select: { status: true } },
    },
  });
  if (!existing) {
    throw new Error(`No OrgSubscription found for Stripe subscription ${sub.id}`);
  }

  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price item");

  const planKey: PlanKey = resolvePlanKey(priceId);
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const itemPeriodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = new Date((itemPeriodEnd ?? sub.billing_cycle_anchor) * 1000);
  const hasPaymentMethod = sub.default_payment_method !== null;
  // confirmation_secret is the new signal for "customer action required" (replaces payment_intent.status === requires_action post-basil API)
  const requiresPaymentAction =
    sub.latest_invoice !== null &&
    typeof sub.latest_invoice === "object" &&
    (sub.latest_invoice as Stripe.Invoice).confirmation_secret !== null;
  const seatCount = sub.items.data[0]?.quantity ?? 1;

  // Fix #12: removed unused prevSubStatus variable
  const prevOrgStatus = existing.organization.status;
  const prevHasPaymentMethod = existing.hasPaymentMethod;

  let newOrgStatus = prevOrgStatus;
  if (sub.status === "trialing") newOrgStatus = OrgStatus.TRIALING;
  else if (sub.status === "active") newOrgStatus = OrgStatus.ACTIVE;
  else if (sub.status === "past_due") newOrgStatus = OrgStatus.PAST_DUE;

  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        stripePriceId: priceId,
        planKey,
        status: sub.status,
        trialEndsAt,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        hasPaymentMethod,
        requiresPaymentAction,
        seatCount,
      },
    });

    if (newOrgStatus !== prevOrgStatus) {
      await tx.organization.update({
        where: { id: existing.organizationId },
        data: { status: newOrgStatus },
      });
    }

    // Fix #10: emit audit/activity inside transaction so DB state and audit trail are atomic
    if (!prevHasPaymentMethod && hasPaymentMethod && prevOrgStatus === OrgStatus.TRIALING) {
      await emitAuditEvent(tx, existing.organizationId,
        AuditAction.SUBSCRIPTION_PAYMENT_METHOD_ADDED, "OrgSubscription", sub.id,
        { hasPaymentMethod: false }, { hasPaymentMethod: true });
      await emitActivityEvent(tx, existing.organizationId,
        "SUBSCRIPTION_PAYMENT_METHOD_ADDED", "OrgSubscription", sub.id);
    }

    if (newOrgStatus !== prevOrgStatus) {
      if (newOrgStatus === OrgStatus.ACTIVE) {
        await emitAuditEvent(tx, existing.organizationId,
          AuditAction.SUBSCRIPTION_ACTIVATED, "OrgSubscription", sub.id,
          { status: prevOrgStatus }, { status: OrgStatus.ACTIVE });
        await emitActivityEvent(tx, existing.organizationId,
          "SUBSCRIPTION_ACTIVATED", "OrgSubscription", sub.id);
      } else if (newOrgStatus === OrgStatus.PAST_DUE) {
        await emitAuditEvent(tx, existing.organizationId,
          AuditAction.SUBSCRIPTION_PAST_DUE, "OrgSubscription", sub.id,
          { status: prevOrgStatus }, { status: OrgStatus.PAST_DUE });
        // PAST_DUE: audit only, no ActivityEvent per fan-out table
      }
    }
  });
}

// ─── Subscription Deleted ────────────────────────────────────────────────────

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.orgSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: {
      organizationId: true,
      organization: { select: { status: true } },
    },
  });
  if (!existing) {
    throw new Error(`No OrgSubscription found for Stripe subscription ${sub.id}`);
  }

  const prevOrgStatus = existing.organization.status;

  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: { status: sub.status, cancelAtPeriodEnd: false },
    });
    await tx.organization.update({
      where: { id: existing.organizationId },
      data: { status: OrgStatus.CANCELLED },
    });
    // Fix #10: emit inside transaction so cancellation and audit trail are atomic
    await emitAuditEvent(tx, existing.organizationId,
      AuditAction.SUBSCRIPTION_CANCELLED, "OrgSubscription", sub.id,
      { status: prevOrgStatus }, { status: OrgStatus.CANCELLED });
    await emitActivityEvent(tx, existing.organizationId,
      "SUBSCRIPTION_CANCELLED", "OrgSubscription", sub.id);
  });
}

// ─── Payment Succeeded ───────────────────────────────────────────────────────

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const parent = invoice.parent;
  const subscriptionId =
    parent?.type === "subscription_details"
      ? (typeof parent.subscription_details?.subscription === "string"
          ? parent.subscription_details.subscription
          : parent.subscription_details?.subscription?.id)
      : undefined;

  if (!subscriptionId) return;

  const existing = await prisma.orgSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: {
      organizationId: true,
      organization: { select: { status: true } },
    },
  });
  if (!existing) {
    throw new Error(`No OrgSubscription found for subscription ${subscriptionId}`);
  }

  const prevOrgStatus = existing.organization.status;

  if (prevOrgStatus !== OrgStatus.TRIAL_EXPIRED && prevOrgStatus !== OrgStatus.PAST_DUE) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { requiresPaymentAction: false },
    });
    await tx.organization.update({
      where: { id: existing.organizationId },
      data: { status: OrgStatus.ACTIVE },
    });
    // Fix #10: emit inside transaction so activation and audit trail are atomic
    await emitAuditEvent(tx, existing.organizationId,
      AuditAction.SUBSCRIPTION_ACTIVATED, "OrgSubscription", subscriptionId,
      { status: prevOrgStatus }, { status: OrgStatus.ACTIVE });
    await emitActivityEvent(tx, existing.organizationId,
      "SUBSCRIPTION_ACTIVATED", "OrgSubscription", subscriptionId);
  });
}

// ─── Payment Failed ──────────────────────────────────────────────────────────

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const parent = invoice.parent;
  const subscriptionId =
    parent?.type === "subscription_details"
      ? (typeof parent.subscription_details?.subscription === "string"
          ? parent.subscription_details.subscription
          : parent.subscription_details?.subscription?.id)
      : undefined;

  if (!subscriptionId) return;

  const existing = await prisma.orgSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: {
      organizationId: true,
      organization: { select: { status: true } },
    },
  });
  if (!existing) {
    throw new Error(`No OrgSubscription found for subscription ${subscriptionId}`);
  }

  const prevOrgStatus = existing.organization.status;

  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { requiresPaymentAction: true },
    });
    if (prevOrgStatus !== OrgStatus.PAST_DUE) {
      await tx.organization.update({
        where: { id: existing.organizationId },
        data: { status: OrgStatus.PAST_DUE },
      });
    }
    // Fix #10: emit inside transaction so status change and audit trail are atomic
    await emitAuditEvent(tx, existing.organizationId,
      AuditAction.SUBSCRIPTION_PAYMENT_FAILED, "OrgSubscription", subscriptionId,
      { status: prevOrgStatus }, { status: OrgStatus.PAST_DUE });
    // PAYMENT_FAILED: audit only, no ActivityEvent per fan-out table
  });
}

// ─── Trial Will End ──────────────────────────────────────────────────────────

async function handleTrialWillEnd(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.orgSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: {
      organizationId: true,
      hasPaymentMethod: true,
      organization: { select: { status: true } },
    },
  });
  if (!existing) {
    throw new Error(`No OrgSubscription found for Stripe subscription ${sub.id}`);
  }

  // Reminder email suppressed if a payment method is already attached.
  // Reminder sent if no payment method.
  if (!existing.hasPaymentMethod) {
    // TODO (Phase 4): send trial-ending reminder email via Resend
    // Fix #21: console.warn with structured object matches project logging pattern
    console.warn("[billing] trial_will_end: no payment method — reminder pending", {
      organizationId: existing.organizationId,
    });
  }
  // No audit or activity event emitted here per spec
}

// ─── Payment Action Required ─────────────────────────────────────────────────

async function handlePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
  const parent = invoice.parent;
  const subscriptionId =
    parent?.type === "subscription_details"
      ? (typeof parent.subscription_details?.subscription === "string"
          ? parent.subscription_details.subscription
          : parent.subscription_details?.subscription?.id)
      : undefined;

  if (!subscriptionId) return;

  await prisma.orgSubscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { requiresPaymentAction: true },
  });
}

// ─── Payment Method Detached ─────────────────────────────────────────────────

async function handlePaymentMethodDetached(pm: Stripe.PaymentMethod): Promise<void> {
  const customerId = pm.customer as string | null;
  if (!customerId) return;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, status: true },
  });
  if (!org) return;

  const sub = await prisma.orgSubscription.findUnique({
    where: { organizationId: org.id },
    select: { stripeSubscriptionId: true, hasPaymentMethod: true },
  });
  if (!sub) return;

  // Fix #10: wrap update + emits in a transaction so detach and audit trail are atomic
  await prisma.$transaction(async (tx) => {
    await tx.orgSubscription.update({
      where: { organizationId: org.id },
      data: { hasPaymentMethod: false },
    });

    await emitAuditEvent(tx, org.id,
      AuditAction.SUBSCRIPTION_PAYMENT_METHOD_DETACHED, "OrgSubscription",
      sub.stripeSubscriptionId, { hasPaymentMethod: true }, { hasPaymentMethod: false });

    // Only emit ActivityEvent when trial is still live
    if (org.status === OrgStatus.TRIALING) {
      await emitActivityEvent(tx, org.id,
        "SUBSCRIPTION_PAYMENT_METHOD_DETACHED", "OrgSubscription", sub.stripeSubscriptionId);
    }
  });
}

// ─── Idempotency Guard + Router ───────────────────────────────────────────────

/**
 * Entry point for all Stripe webhook events.
 * Records the event for idempotency before dispatching to the correct handler.
 * A Prisma P2002 (unique violation) on StripeWebhookEvent means the event was
 * already processed — return cleanly without re-running the handler.
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err: unknown) {
    // P2002 = unique constraint violation → already processed
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return;
    }
    throw err;
  }

  // Fix #1: processedAt must only be written on success so Stripe can retry failed events.
  // Using finally() stamped processedAt even when dispatch() threw, silently swallowing retries.
  await dispatch(event);
  await prisma.stripeWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_action_required":
      await handlePaymentActionRequired(event.data.object as Stripe.Invoice);
      break;
    case "payment_method.detached":
      await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
      break;
    default:
      // Unhandled event types are silently ignored
      break;
  }
}
