# Phase 0 — Stripe Webhooks, Org Subscription Lifecycle, and Billing Crons

## Goal

Every new organization starts on a 14-day free trial with full Growth-equivalent access. Stripe webhooks drive org status transitions. Two billing crons catch orgs that fall through webhook gaps. The `requireOrgActive()` middleware (built in Phase 0-02) is already live — this slice wires up the Stripe-side events that feed it.

## Prerequisites

- Phase 0-01 (database): `OrgSubscription`, `StripeWebhookEvent`, `Organization`, `AuditEvent` tables exist.
- Phase 0-02 (auth): `requireOrgContext()`, `OrgInactiveError`, error types available.
- Phase 0-00 (setup): Stripe test account, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_GROWTH` set.

---

## Spec

### 1. Install dependencies

```bash
pnpm add stripe
```

### 2. Stripe client singleton

Create `src/lib/billing/stripe.ts`:

```ts
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  typescript: true,
});
```

### 3. Org subscription lifecycle — status enum

`Organization.status` is Veracrew's own coarse state. `OrgSubscription.status` mirrors Stripe's verbatim (e.g. `"trialing"`, `"active"`, `"past_due"`). They are kept in sync by webhook handlers and crons.

```
TRIALING        days 0–14, full feature access, no charge yet
ACTIVE          paying customer, full access
PAST_DUE        Stripe dunning in progress; fully functional + red banner; 7d grace then drops
TRIAL_EXPIRED   read-only lockout; reads + exports + sign-in + clock-out on open entries allowed
CANCELLED       subscription ended; 90-day export-only grace
SUSPENDED       Veracrew-only support override; full lockout including reads
```

### 4. Signup-to-billing flow

When an Owner completes onboarding step 1 (creates the org), the server action MUST:

1. Create a Stripe Customer: `stripe.customers.create({ email, name: orgName, metadata: { organizationId } })`
2. Create a Stripe Subscription with a 14-day trial: `stripe.subscriptions.create({ customer: customerId, items: [{ price: STRIPE_PRICE_ID_GROWTH }], trial_end: Math.floor((Date.now() + 14 * 86400000) / 1000), payment_behavior: "default_incomplete" })`
3. In the same Prisma transaction:
   - Set `Organization.stripeCustomerId = customerId`
   - Set `Organization.status = "TRIALING"`
   - Create `OrgSubscription` row: `{ stripeSubscriptionId, stripePriceId, planKey: "GROWTH", status: "trialing", trialEndsAt: <+14d>, currentPeriodEnd: <+14d>, hasPaymentMethod: false }`
4. Emit `AuditEvent` with action `SUBSCRIPTION_TRIAL_STARTED` and `ActivityEvent` (feed-worthy).
5. If Stripe API throws: roll back the DB transaction. Never leave an orphan DB row pointing at a failed Stripe call.

### 5. Plan key mapping

Create `src/lib/billing/plan-mapping.ts`:

```ts
import type { PlanKey } from "@prisma/client";

const TEST_MAP: Record<string, PlanKey> = {
  [process.env.STRIPE_PRICE_ID_GROWTH!]: "GROWTH",
};
const LIVE_MAP: Record<string, PlanKey> = {
  [process.env.STRIPE_LIVE_PRICE_GROWTH!]: "GROWTH",
};

export function resolvePlanKey(priceId: string): PlanKey {
  const isLive = process.env.NODE_ENV === "production" && process.env.STRIPE_MODE === "live";
  const map = isLive ? LIVE_MAP : TEST_MAP;
  const plan = map[priceId];
  if (!plan) {
    // Never silently default to STARTER. Throw so the webhook retries and ops sees it in Sentry.
    throw new Error(`Unknown Stripe priceId: ${priceId}`);
  }
  return plan;
}
```

**Rules:**
- Never silently default to `STARTER`. The Prisma `@default(STARTER)` is a DB safety floor only — every code path that writes `OrgSubscription.planKey` calls `resolvePlanKey()` and sets it explicitly.
- Test-mode and live-mode price IDs are completely separate maps.

### 6. Plan limits (scaffolded but inert in MVP)

Create `src/lib/billing/plan-limits.ts`:

```ts
import type { PlanKey } from "@prisma/client";

export type FeatureFlag =
  | "fullScheduler"
  | "jobRequiredDocs"
  | "perJobRoleRates"
  | "dailyAndWeeklyOT"
  | "groupMessaging"
  | "webPush"
  | "auditExport"
  | "jsonExport"
  | "apiAccess"
  | "sso"
  | "multiOrgAdmin"
  | "customStarterPacks"
  | "messageRetentionConfig";

export interface PlanLimits {
  maxWorkers: number | null;
  maxLocations: number | null;
  maxInvoicesPerMonth: number | null;
  maxStarterPacks: number | null;
  features: Set<FeatureFlag>;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  STARTER: {
    maxWorkers: 5,
    maxLocations: 1,
    maxInvoicesPerMonth: 5,
    maxStarterPacks: 1,
    features: new Set(["webPush"]),
  },
  GROWTH: {
    maxWorkers: 50,
    maxLocations: 5,
    maxInvoicesPerMonth: null,
    maxStarterPacks: null,
    features: new Set([
      "fullScheduler", "jobRequiredDocs", "perJobRoleRates",
      "dailyAndWeeklyOT", "groupMessaging", "webPush",
      "auditExport", "jsonExport",
    ]),
  },
  SCALE: {
    maxWorkers: null,
    maxLocations: null,
    maxInvoicesPerMonth: null,
    maxStarterPacks: null,
    features: new Set([
      "fullScheduler", "jobRequiredDocs", "perJobRoleRates",
      "dailyAndWeeklyOT", "groupMessaging", "webPush",
      "auditExport", "jsonExport", "apiAccess", "sso",
      "multiOrgAdmin", "customStarterPacks", "messageRetentionConfig",
    ]),
  },
};

import type { OrgContext } from "@/lib/auth/types";
import { PlanLimitError } from "@/lib/errors";

/**
 * MVP: these helpers are no-ops. They are called from server actions today
 * so Phase 8 can flip them on without chasing every call site.
 */
export function requireFeature(_flag: FeatureFlag, _ctx: OrgContext): void {
  // no-op in MVP
}

export async function requireWithinLimit(
  _resource: "workers" | "locations" | "invoices",
  _ctx: OrgContext
): Promise<void> {
  // no-op in MVP
}
```

### 7. Webhook route

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { handleStripeWebhook } from "@/lib/billing/webhook-handlers";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  try {
    await handleStripeWebhook(event);
  } catch (err) {
    // Return 500 so Stripe retries
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

### 8. Webhook handlers (idempotent)

Create `src/lib/billing/webhook-handlers.ts`:

The golden rule: **check + insert into `StripeWebhookEvent` first**. A unique-key violation means the event already ran — exit cleanly.

```ts
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { resolvePlanKey } from "./plan-mapping";

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  // Idempotency check — unique violation = already processed
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payload: event as unknown as Record<string, unknown>,
      },
    });
  } catch {
    // P2002 = unique constraint — already processed
    return;
  }

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
      // Unknown events are silently ignored. Stripe retries only on 4xx/5xx.
      break;
  }

  await prisma.stripeWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });
}
```

**Each handler's responsibility:**

| Event | What to do | `Organization.status` transition |
|---|---|---|
| `customer.subscription.created` | Upsert `OrgSubscription`; resolve `planKey` via `resolvePlanKey()` | `→ TRIALING` (new trial) or `→ ACTIVE` (skip-trial) |
| `customer.subscription.updated` | Sync `status`, `currentPeriodEnd`, `trialEndsAt`, `cancelAtPeriodEnd`, `hasPaymentMethod`, re-resolve `planKey` | Mirror Stripe: `trialing→active`, `active→past_due`, etc. |
| `customer.subscription.deleted` | Flip `Organization.status = CANCELLED`; start 90-day export-grace (Phase 8 cron) | `→ CANCELLED` |
| `invoice.payment_succeeded` | Clear `requiresPaymentAction`. Primary reactivation path. | `PAST_DUE → ACTIVE`; `TRIAL_EXPIRED → ACTIVE`; `TRIALING → ACTIVE` |
| `invoice.payment_failed` | Set payment failed flag; queue email. | `ACTIVE → PAST_DUE`; `TRIALING → PAST_DUE` (Stripe still has retries) |
| `customer.subscription.trial_will_end` | Send "trial ends in 3 days" email — suppress if `hasPaymentMethod = true` | none |
| `invoice.payment_action_required` | Set `OrgSubscription.requiresPaymentAction = true`; surface banner + email with Stripe auth URL | none |
| `payment_method.detached` | Flip `hasPaymentMethod = false`; un-suppress trial reminder email if trial still live | none |

**Invariant:** Every handler that changes `Organization.status` also:
1. Emits an `AuditEvent` with the relevant `AuditAction`
2. Double-writes an `ActivityEvent` for feed-worthy transitions (see fan-out table below)

**Fan-out to ActivityEvent:**

| AuditAction | AuditEvent | ActivityEvent |
|---|:---:|:---:|
| `SUBSCRIPTION_TRIAL_STARTED` | yes | yes |
| `SUBSCRIPTION_PAYMENT_METHOD_ADDED` | yes | yes |
| `SUBSCRIPTION_PAYMENT_METHOD_DETACHED` | yes | yes |
| `SUBSCRIPTION_ACTIVATED` | yes | yes |
| `SUBSCRIPTION_PAYMENT_FAILED` | yes | **no** — banner + urgent Notification, not feed |
| `SUBSCRIPTION_PAST_DUE` | yes | **no** |
| `SUBSCRIPTION_TRIAL_EXPIRED` | yes | yes |
| `SUBSCRIPTION_CANCELLED` | yes | yes |
| `SUBSCRIPTION_REACTIVATED` | yes | yes |
| `ORG_REACTIVATE_MANUAL` | yes | **no** — support actions don't appear on customer feed |

### 9. Billing crons

**Critical invariant (enforce in every code review):**

> Billing crons query `WHERE status = <state> AND <date_field> < now()` — a catch-up query. Never query for `= today`. A cron that only acts on "today's" orgs permanently misses any org the cron skipped due to a missed run.

Create `src/jobs/billing-crons.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

/**
 * Cron 1: TRIALING → TRIAL_EXPIRED
 * Schedule: every day at 00:00 UTC via Vercel Cron
 * Catches orgs whose trial period ended with no payment method attached.
 */
export async function checkTrialExpiry(): Promise<void> {
  const expiredOrgs = await prisma.orgSubscription.findMany({
    where: {
      status: "trialing",
      trialEndsAt: { lt: new Date() },
      hasPaymentMethod: false,
    },
    include: { organization: { select: { id: true, status: true } } },
  });

  for (const sub of expiredOrgs) {
    if (sub.organization.status !== "TRIALING") continue; // already transitioned

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: sub.organizationId },
        data: { status: "TRIAL_EXPIRED" },
      }),
      prisma.orgSubscription.update({
        where: { id: sub.id },
        data: { status: "trialing" }, // Stripe status stays trialing until canceled
      }),
      prisma.auditEvent.create({
        data: {
          organizationId: sub.organizationId,
          actorUserId: "system",
          action: "SUBSCRIPTION_TRIAL_EXPIRED",
          resourceType: "OrgSubscription",
          resourceId: sub.id,
          after: { status: "TRIAL_EXPIRED" },
        },
      }),
    ]);

    // TODO: queue "trial expired" email to OWNER + ADMINs via Resend
  }
}

/**
 * Cron 2: PAST_DUE → TRIAL_EXPIRED (after 7-day grace)
 * Schedule: every day at 00:00 UTC via Vercel Cron
 * Catches paying customers who never resolved a failed payment after 7 days of dunning.
 */
export async function checkPastDueExpiry(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  // Find PAST_DUE orgs — we use the Organization.updatedAt as a proxy for when
  // the PAST_DUE transition happened. A more precise solution (pastDueEnteredAt column)
  // should be added in Phase 8 if needed.
  const pastDueOrgs = await prisma.organization.findMany({
    where: {
      status: "PAST_DUE",
      updatedAt: { lt: sevenDaysAgo },
    },
    select: { id: true },
  });

  for (const org of pastDueOrgs) {
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: org.id },
        data: { status: "TRIAL_EXPIRED" },
      }),
      prisma.auditEvent.create({
        data: {
          organizationId: org.id,
          actorUserId: "system",
          action: "SUBSCRIPTION_TRIAL_EXPIRED",
          resourceType: "Organization",
          resourceId: org.id,
          after: { status: "TRIAL_EXPIRED", reason: "past_due_7d_grace_expired" },
        },
      }),
    ]);
  }
}
```

Register crons in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/crons/billing",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Create `src/app/api/crons/billing/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { checkTrialExpiry, checkPastDueExpiry } from "@/jobs/billing-crons";

export async function GET(req: NextRequest) {
  // Vercel Cron sends a secret header
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await checkTrialExpiry();
  await checkPastDueExpiry();

  return NextResponse.json({ ok: true });
}
```

Add `CRON_SECRET` to `.env.example` (generate with `openssl rand -hex 32`).

### 10. SUPERUSER manual reactivation

Create `src/actions/billing/manually-reactivate-org.ts`:

```ts
"use server";
// SUPERUSER-only. Requires the caller to be a SUPERUSER (not a regular OWNER).
// This is a support escape hatch — it MUST call the Stripe API, never flip DB only.
export async function manuallyReactivateOrg(
  organizationId: string,
  reason: string
): Promise<void> {
  // 1. Verify caller is a SUPERUSER (implement SUPERUSER role check)
  // 2. Load OrgSubscription.stripeSubscriptionId
  // 3. Call stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
  //    and if sub is cancelled, stripe.subscriptions.create(...) a new one
  // 4. In the same DB transaction:
  //    - Set Organization.status = ACTIVE
  //    - Set OrgSubscription.status = "active"
  //    - Emit AuditEvent action: ORG_REACTIVATE_MANUAL with reason
  // 5. Never set Organization.status = ACTIVE without also aligning Stripe state.
  //    A subsequent Stripe webhook must not be able to flip us back to a stale state.
  throw new Error("Not implemented");
}
```

**Invariant (enforce in code review):** `manuallyReactivateOrg` MUST call the Stripe API to un-cancel/re-activate the subscription. Never add a "flip DB only" path — it diverges from Stripe state and the next webhook will overwrite it.

### 11. Cancel-during-trial vs cancel-during-paid-period

When an admin cancels their subscription, the behavior depends on their current state:

| Current state | Cancel action | Stripe call | Org status |
|---|---|---|---|
| `TRIALING` | Immediate cancel | `stripe.subscriptions.cancel(id)` | `→ CANCELLED` immediately |
| `ACTIVE` | Cancel at period end | `stripe.subscriptions.update(id, { cancel_at_period_end: true })` | Stays `ACTIVE` until `currentPeriodEnd`, then `→ CANCELLED` |
| `PAST_DUE` | Immediate cancel | `stripe.subscriptions.cancel(id)` | `→ CANCELLED` immediately |
| `TRIAL_EXPIRED` | Immediate cancel | `stripe.subscriptions.cancel(id)` if sub still exists | `→ CANCELLED` immediately |

---

## Tests required

- [ ] **Webhook idempotency**: send the same Stripe event twice → second call exits cleanly, no duplicate DB row, no duplicate audit event.
- [ ] **Webhook signature verification**: an unsigned or wrongly-signed request returns 400.
- [ ] **`customer.subscription.updated` — trialing → active**: simulate `status: "active"` event → `Organization.status` flips to `ACTIVE`, audit event emitted.
- [ ] **`invoice.payment_failed` — active → past_due**: simulate `status: "past_due"` → `Organization.status = PAST_DUE`.
- [ ] **`invoice.payment_succeeded` — TRIAL_EXPIRED → ACTIVE**: simulate payment on a `TRIAL_EXPIRED` org → flips to `ACTIVE`.
- [ ] **`customer.subscription.trial_will_end` — email suppressed when card on file**: org with `hasPaymentMethod = true` → no email queued.
- [ ] **`customer.subscription.trial_will_end` — email sent when no card**: org with `hasPaymentMethod = false` → email queued.
- [ ] **`checkTrialExpiry` cron — catches overdue orgs**: create an org with `trialEndsAt = 2 days ago`, `hasPaymentMethod = false`, `status = TRIALING` → after `checkTrialExpiry()`, org status is `TRIAL_EXPIRED`.
- [ ] **`checkTrialExpiry` cron — ignores already-expired orgs**: org already at `TRIAL_EXPIRED` → no change.
- [ ] **`resolvePlanKey` — unknown price throws**: `resolvePlanKey("price_unknown_123")` throws.
- [ ] **`requireOrgActive` — TRIAL_EXPIRED throws `OrgInactiveError`**: covered by Phase 0-02 tests.
- [ ] **Billing cron endpoint — unauthenticated 401**: GET `/api/crons/billing` without `CRON_SECRET` header → 401.

---

## Definition of Done

- [ ] `pnpm add stripe` installed
- [ ] `src/lib/billing/stripe.ts` — Stripe singleton
- [ ] `src/lib/billing/plan-mapping.ts` — `resolvePlanKey()`
- [ ] `src/lib/billing/plan-limits.ts` — `PLAN_LIMITS`, `requireFeature` (no-op), `requireWithinLimit` (no-op)
- [ ] `src/lib/billing/webhook-handlers.ts` — all 8 webhook event handlers, idempotent
- [ ] `src/app/api/webhooks/stripe/route.ts` — signature verification, handler call
- [ ] `src/jobs/billing-crons.ts` — `checkTrialExpiry`, `checkPastDueExpiry`
- [ ] `src/app/api/crons/billing/route.ts` — cron endpoint with auth
- [ ] `vercel.json` — cron schedule registered
- [ ] `.env.example` updated with `CRON_SECRET`, `STRIPE_LIVE_PRICE_GROWTH`, `STRIPE_MODE`
- [ ] All tests pass: `pnpm vitest run`
- [ ] Webhook tested end-to-end with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
