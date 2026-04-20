"use server";

import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/billing/stripe";
import { resolvePlanKey } from "@/lib/billing/plan-mapping";
import { env } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { AuditAction } from "@/generated/prisma/client";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
  country: z.string().min(2).max(2),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  defaultLocale: z.enum(["en", "fr"]),
});

export type CreateOrgResult =
  | { success: true; organizationId: string }
  | { error: string };

export async function createOrganization(input: unknown): Promise<CreateOrgResult> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();

  const parsed = CreateOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, country, timezone, currency, defaultLocale } = parsed.data;
  const userId = session.user.id;
  const userEmail = session.user.email ?? "";

  // Check if user already has an org (prevent double-creation)
  const existing = await prisma.membership.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (existing) {
    return { success: true, organizationId: existing.organizationId };
  }

  let organizationId: string;

  try {
    // Step 1: Create org + membership in a transaction
    const { organization } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name, country, timezone, currency, defaultLocale },
        select: { id: true },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: "OWNER",
        },
      });

      return { organization };
    });

    organizationId = organization.id;
  } catch (err) {
    console.error("[createOrganization] DB transaction failed", { err });
    return { error: "Failed to create organization. Please try again." };
  }

  // Step 2: Provision Stripe customer + trial subscription
  try {
    const customer = await stripe.customers.create({
      email: userEmail,
      name,
      metadata: { organizationId },
    });

    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 86_400;

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: env.STRIPE_PRICE_ID_GROWTH }],
      trial_end: trialEnd,
      payment_behavior: "default_incomplete",
    });

    const planKey = resolvePlanKey(env.STRIPE_PRICE_ID_GROWTH);

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customer.id },
      }),
      prisma.orgSubscription.create({
        data: {
          organizationId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: env.STRIPE_PRICE_ID_GROWTH,
          planKey,
          status: "trialing",
          trialEndsAt: new Date(trialEnd * 1000),
          currentPeriodEnd: new Date(trialEnd * 1000),
          seatCount: 1,
        },
      }),
      prisma.auditEvent.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: AuditAction.CREATE,
          resourceType: "Organization",
          resourceId: organizationId,
        },
      }),
    ]);
  } catch (err) {
    console.error("[createOrganization] Stripe provisioning failed, rolling back org", { err });
    // Roll back the org if Stripe fails
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => null);
    return { error: "Failed to set up billing. Please try again or contact support." };
  }

  return { success: true, organizationId };
}
