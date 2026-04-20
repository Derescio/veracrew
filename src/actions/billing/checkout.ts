"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

export type CheckoutResult =
  | { url: string }
  | { error: string };

export async function createCheckoutSession(): Promise<CheckoutResult> {
  const ctx = await requireOrgContext();
  requireRole("ADMIN", ctx);

  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) return { error: "No Stripe customer found." };

  const sub = await prisma.orgSubscription.findUnique({
    where: { organizationId: ctx.organizationId },
    select: { stripeSubscriptionId: true, trialEndsAt: true },
  });

  if (!sub?.stripeSubscriptionId) return { error: "No subscription found." };

  const session = await stripe.checkout.sessions.create({
    customer: org.stripeCustomerId,
    mode: "setup",
    payment_method_types: ["card"],
    setup_intent_data: {
      metadata: { subscription_id: sub.stripeSubscriptionId },
    },
    success_url: `${env.NEXTAUTH_URL}/en/settings/billing?setup=success`,
    cancel_url: `${env.NEXTAUTH_URL}/en/settings/billing`,
  });

  if (!session.url) return { error: "Failed to create checkout session." };

  return { url: session.url };
}

export async function skipTrialCheckout(): Promise<CheckoutResult> {
  const ctx = await requireOrgContext();
  requireRole("ADMIN", ctx);

  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) return { error: "No Stripe customer found." };

  const session = await stripe.checkout.sessions.create({
    customer: org.stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: env.STRIPE_PRICE_ID_GROWTH, quantity: 1 }],
    success_url: `${env.NEXTAUTH_URL}/en/settings/billing?activated=true`,
    cancel_url: `${env.NEXTAUTH_URL}/en/settings/billing`,
  });

  if (!session.url) return { error: "Failed to create checkout session." };

  return { url: session.url };
}

const CancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelResult = { success: true } | { error: string };

export async function cancelSubscription(input: unknown): Promise<CancelResult> {
  const ctx = await requireOrgContext();
  requireRole("OWNER", ctx);

  const parsed = CancelSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const sub = await prisma.orgSubscription.findUnique({
    where: { organizationId: ctx.organizationId },
    select: { stripeSubscriptionId: true, status: true },
  });

  if (!sub?.stripeSubscriptionId) return { error: "No active subscription found." };

  const status = sub.status;

  if (status === "trialing" || status === "past_due") {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  } else if (status === "active") {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return { error: "Subscription cannot be cancelled in its current state." };
  }

  return { success: true };
}
