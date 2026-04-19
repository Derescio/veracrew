# Veracrew — Edge Cases & Deferred Items

Living register of known edge cases, risks, and deferred behaviours that are **not MVP-blocking**. Each entry exists here so it survives context-switching between planning and implementation. Anything in this file that becomes MVP-blocking gets promoted into [`architecture.md`](./architecture.md) + an item in [`implementation_checklist.md`](./implementation_checklist.md).

> **How to use this file**: when a new edge case, risk, or deferred behaviour comes up in planning or code review, add it here with a status tag. Don't let it live only in chat or in a PR comment. Re-triage at the start of each phase.

---

## Status legend

| Tag | Meaning |
|---|---|
| **Deferred — Phase N** | Scheduled work with a target phase |
| **Risk accepted** | Known, tolerated for MVP, revisit post-launch |
| **Needs product decision** | Unresolved; surface before the linked phase starts |
| **Monitor** | No action planned; watch frequency and escalate if it materializes |

---

## Billing & subscriptions

### SCA / 3DS admin UX polish

- **Status**: Risk accepted → **Deferred — Phase 8**
- **Context**: European and UK cards increasingly require bank-side authentication (SCA). Stripe parks the payment in `requires_action` and emits `invoice.payment_action_required`. MVP ships the basic handler in Phase 0 (flip `OrgSubscription.requiresPaymentAction = true`, surface a banner + email). The polished recovery flow — deep-linked "authenticate with your bank" screen, retry wizard, bank-specific copy — is deferred.
- **Resolution when promoted**: dedicated `/settings/billing/authenticate` route that embeds Stripe's hosted authentication page; branded email with the authentication URL; retry-after-failure UX.

### Re-trial abuse (same user, multiple orgs)

- **Status**: Deferred — Phase 8
- **Context**: A user whose org trial expires can create a second org under the same account (or a different email + same card) and get a fresh 14-day trial. MVP accepts this — the unit economics of a well-converted trial dominate a handful of abusers. `docs/architecture.md` §6.7.3 explicitly does **not** grant a new trial on reactivation of an existing org, but a brand-new org starts fresh regardless.
- **Resolution when promoted**: detection heuristic on `Organization.createdAt` + shared `stripeCustomerId` / email domain / IP; CAPTCHA-on-second-trial challenge; ops dashboard surface.

### Org soft-delete → Stripe subscription cascade

- **Status**: **Resolved** — implement before Phase 1 org-delete flow ships
- **Decision**: On org soft-delete, cancel the Stripe subscription in the same logical transaction (or compensating saga), e.g. `stripe.subscriptions.cancel(..., { invoice_now: false, prorate: true })`. Webhook `customer.subscription.deleted` remains idempotent. See [`context/features/phase-0-product-decisions.md`](../context/features/phase-0-product-decisions.md).

### OWNER succession when sole OWNER is deleted

- **Status**: Deferred — Phase 8
- **Context**: Rare but possible: the only `OWNER` of an org deletes their account (GDPR erasure, ops mistake) while the org has an active subscription. Today nothing blocks it; the result is an orphan subscription and an unmanageable org.
- **Resolution when promoted**: server-side guard on `deleteUser` / `suspendMembership` — if the user is the **sole** `OWNER` of any org with a non-`CANCELLED` subscription, block the action and require promoting another `OWNER` first. Support escalation is the MVP fallback.

### Different email at Stripe reactivation

- **Status**: Risk accepted
- **Context**: Admin reactivates via Stripe Checkout and enters an email different from their Veracrew login. Stripe may create a **second** `Customer` record. Our webhook handlers in `docs/architecture.md` §6.7 look up orgs by `stripeCustomerId`, so an unfamiliar customer id means "no org found" and the webhook short-circuits.
- **Resolution**: fall back to `subscription.id` lookup on unknown `customer.id`. If the subscription id maps to an existing org, update `Organization.stripeCustomerId` to the new customer id and emit `ORG_STATUS_CHANGED` with the customer-id change in the audit payload. Promote to Phase 0 only if the implementation is trivial inside the existing webhook handlers; otherwise ship as a Phase 8 resilience pass.

### SUPERUSER manual override vs next Stripe webhook

- **Status**: Risk accepted — documented invariant
- **Context**: Support flips `Organization.status = ACTIVE` via `manuallyReactivateOrg` (see checklist Phase 0). If Stripe doesn't also know the subscription is active, the very next webhook event (`customer.subscription.updated`, `customer.subscription.deleted`) can flip us back.
- **Invariant (enforce in code review)**: `manuallyReactivateOrg` MUST also call the Stripe API to un-cancel / re-activate the subscription in the same transaction. The two sources of truth stay in sync. Never add a "flip status only" support path — it will diverge.

### Stripe API 5xx during signup

- **Status**: Risk accepted
- **Context**: Org-creation transaction rolls back if Stripe Customer or Subscription creation fails (`docs/architecture.md` §6.7.3 and checklist Phase 1). From the owner's perspective: they clicked "Create organization" and got an error.
- **Resolution**: user-facing copy — "We couldn't set up your trial. This is a Veracrew issue, not yours. Please retry in a few minutes." Sentry alert on Stripe 5xx rate > N per minute. No automatic retry; the owner retries manually.

### Orphan Stripe Customer on partial signup failure

- **Status**: Risk accepted
- **Context**: If `stripe.customers.create` succeeds but `stripe.subscriptions.create` fails, the Veracrew transaction rolls back — no Organization row exists — but the Stripe Customer is real. It lingers in the Stripe dashboard.
- **Resolution for MVP**: accept the orphans. Run a quarterly support script: `stripe customers list --expand=subscriptions` → delete customers with zero subscriptions and zero invoices. No compensating action in the signup code (adds complexity, retry-storms, partial-failure on the delete).

### Multi-environment dedupe collision in `StripeWebhookEvent`

- **Status**: Risk accepted → Monitor
- **Context**: Test-mode and live-mode Stripe events have separate namespaces for `event.id`, but in principle a shared `StripeWebhookEvent` table across environments could collide if any CI / staging / local dev points at the same Postgres.
- **Resolution if it ever fires**: migrate the primary key from `id` to composite `(environment, id)` where `environment ∈ { test, live }`. Monitor for primary-key collisions; no preemptive change.

### Multi-org user with mixed statuses

- **Status**: Deferred — Phase 1 UI polish
- **Context**: A user who is `OWNER` of org A (`ACTIVE`) and `OWNER` of org B (`TRIAL_EXPIRED`) will see the Phase 1 billing banners from §4.1 change per active-org context. The org switcher needs a per-org status badge so the transition isn't jarring.
- **Resolution**: org switcher dropdown shows a coloured dot per org (green `ACTIVE` / blue `TRIALING` / red `TRIAL_EXPIRED` / grey `CANCELLED`). Banner reflects currently-active org only. Logged here so the switcher UI work in Phase 1 doesn't ship without the badge.

### GDPR right-to-erasure includes Stripe

- **Status**: Deferred — Phase 8
- **Context**: A user deletion request must also erase their PII from Stripe (Customer record, saved payment methods). Stripe exposes `customers.del`. MVP does not implement the full GDPR pipeline.
- **Resolution when promoted**: `deleteUserPipeline` calls `stripe.customers.del(stripeCustomerId)` as part of the cascade. If the Customer is shared with active orgs (shouldn't happen but possible via cross-org admin), block the delete with a specific error until org memberships are resolved.

### Trial extension for enterprise sales

- **Status**: Deferred — Phase 8
- **Context**: Sales sometimes needs to extend a trial by 7–14 days for an enterprise prospect evaluating Veracrew. No UI for this in MVP.
- **MVP workaround**: runbook step — support agent updates `OrgSubscription.trialEndsAt` directly and issues `stripe.subscriptions.update(sub_id, { trial_end: <new_unix_ts> })`. Emit a manual `AuditEvent` with action `TRIAL_EXTENDED`.
- **Resolution when promoted**: `SUPERUSER`-only server action `extendTrial(ctx, organizationId, days, reason)` that does both updates inside a single transaction + emits `TRIAL_EXTENDED`. Email the `OWNER` on extension.

### Cron missed-run recovery — documented invariant

- **Status**: Risk accepted — documented invariant
- **Context**: Vercel Cron occasionally misses a run. A narrow query like `WHERE trialEndsAt = today` would permanently skip affected orgs.
- **Invariant (enforce in code review)**: billing crons query `WHERE trialEndsAt < now() AND status = TRIALING AND hasPaymentMethod = false` — catch up all overdue transitions, not only today's. The same rule applies to the `PAST_DUE → TRIAL_EXPIRED` 7-day grace cron. Stated here so future contributors don't narrow the filter under performance pressure.

### Webhook-after-cron ordering

- **Status**: Deferred — Phase 1 tests
- **Context**: Cron flips `TRIALING → TRIAL_EXPIRED` at UTC midnight. Seconds later, a delayed `invoice.payment_succeeded` webhook arrives and flips `TRIAL_EXPIRED → ACTIVE`. Final state is correct (per `docs/architecture.md` §6.7) but the log sequence looks weird.
- **Resolution**: explicit Playwright test under Phase 1 DoD that simulates this ordering with the Stripe Test Clock. The current logic already handles it — the test is for regression protection.

### `invoice.finalization_failed`

- **Status**: Monitor
- **Context**: Stripe fails to finalize an invoice due to tax config or price anomaly. The subscription stays in `incomplete` and no charge occurs. Very rare.
- **Resolution**: log to Sentry, no user-facing action. Add a handler if frequency > 0 per quarter. Flagged here so ops doesn't chase a mysterious "no charge on day 14" report.

### Stripe Test Clock flakiness in CI

- **Status**: Monitor
- **Context**: Test Clocks have timing drift against CI runner clocks. Past projects have seen flaky "trial expired" assertions.
- **Resolution**: document the flake pattern in the Phase 1 test harness README when Test Clock is introduced. Use 60-second buffers around boundaries in assertions (`trialEndsAt ± 60s`).

---

## Identity & org lifecycle

### OWNER account deletion with live subscription

See **Billing & subscriptions → OWNER succession when sole OWNER is deleted**. Same edge case, logged under both categories for discoverability.

### Membership SUSPENDED for the last ADMIN on payroll day

- **Status**: **Needs product decision** — surface before Phase 3 starts
- **Context**: An org suspends its last `ADMIN`-role `Membership`. The `OWNER` can still export payroll (`OWNER > ADMIN` in the hierarchy), but a prompt / warning before the final suspension avoids a panic call on payday.
- **Proposed resolution**: server-side guard — suspending the last non-`OWNER` `ADMIN` requires a confirm dialog (not a block). Email the `OWNER` automatically. Surface this in Phase 3 when member-suspend UI lands.

### Cross-org admin switching mid-mutation

- **Status**: Risk accepted
- **Context**: User is admin in orgs A and B. Opens org A in tab 1, org B in tab 2. Starts a mutation in tab 1, switches active org to B via the switcher in tab 2, finishes the mutation in tab 1. `requireOrgContext` re-resolves org on every request (`docs/architecture.md` §4), so the mutation lands in the org that was active at the **moment the action fired** — not the one the user thinks they're in.
- **Resolution**: MVP relies on `requireOrgContext`'s per-request resolution. UX-level: display the active-org name in the submit button's disabled-state tooltip on long-form pages. Log and move on.

---

## Compliance & legal

### GDPR right-to-erasure — in-product user deletion

- **Status**: Risk accepted for MVP (tombstoning). Full per-user redaction **Deferred — Phase 8+**.
- **Context**: `architecture.md` §6.11.4 defines our MVP approach: hard-deleting a user anonymizes PII in-place (`former-worker-<last4>` name, `tombstone+<id>@veracrew.invalid` email, image/phone/locale nulled). The id persists so `AuditEvent.actorUserId`, `TimeEntry.userId`, etc. continue to resolve. PII never enters `AuditEvent.before` / `.after` because the emitter redacts it at write time (§12). This satisfies the spirit of erasure under the legal basis of statutory employment records (Canada/US: 7 years).
- **Gap from a strict EU interpretation**: a regulator could argue the opaque tombstone id is still "personal data" because it remains linkable to the original person via external records (the ex-worker's own knowledge of their id). MVP accepts this gap — SMB customers are overwhelmingly Canada/US.
- **Resolution when promoted**: proper SAR pipeline — export all rows referencing the user id to a signed archive delivered to the user; then, on explicit regulator-grade erasure request, run a SUPERUSER flow that rotates the `userId` on the tombstone row to a fresh cuid AND updates every FK reference (`Membership.userId` with `onDelete: Restrict` blocks accidental orphaning). Audit event `USER_ERASED` distinct from `USER_TOMBSTONED`. Legal review required.

### GDPR right-to-erasure — Stripe cascade

See **Billing & subscriptions → GDPR right-to-erasure includes Stripe** for the primary entry.

### User tombstone semantics — former-worker display name

- **Status**: Risk accepted — documented invariant
- **Context**: Tombstoned users render as `former-worker-<last4>` everywhere their id appears in historical views (timesheets, audit exports, job activity). Two users can in principle share the same last-4 substring; the id is still unique but the label is not.
- **Invariant (enforce in code review)**: NEVER use the tombstone display name as a lookup key or for equality. Always resolve by `userId`. The display name is a UX affordance, not an identifier. Logged here so future search / export features don't accidentally treat `former-worker-XXXX` as a primary key.

### Organization cascade blocked by child legal hold

- **Status**: Risk accepted — documented invariant, SUPERUSER manual override
- **Context**: `Membership` / `Location` / `Shift` / etc. cascade `onDelete` when an `Organization` is hard-deleted (§6.11.5). BUT `Invoice` and `TimeEntry` carry their own `legalHoldUntil` (default 7 years). When the `purgeSoftDeleted` cron tries to cascade-delete an org with unexpired child legal holds, the DB will reject the cascade.
- **Resolution**: cron does NOT auto-cascade orgs. It surfaces soft-deleted orgs older than 30 days to the SUPERUSER console for manual review (checklist Phase 8). The operator has three choices: (a) extend the soft-delete grace, (b) wait for child legal holds to expire naturally, (c) clear `Organization.legalHoldUntil` AND individual child `legalHoldUntil` values with a `ORG_LEGAL_HOLD_SET` audit entry, then cascade. Fully automated cascade is deferred indefinitely — legal risk too high to delegate to a nightly cron.

### R2 orphan from failed `finalizeUpload`

- **Status**: Risk accepted — compensating worker + weekly reconciler
- **Context**: Presigned upload succeeds; browser PUTs the object to R2; the `finalizeUpload` server action then fails (network error, validation reject, race). No DB row exists but the R2 object does. Without a compensating path the object leaks.
- **Resolution in MVP**: two defenses. (1) The `finalizeUpload` catch block enqueues an `R2DeletionJob` with `reason = "finalizeUpload rollback"` synchronously — this is the primary defense (§8). (2) Weekly `r2Reconciler` cron lists R2 keys and enqueues orphans >7 days old as a backstop (§6.11.3). Both paths audited.
- **Watch condition**: if R2 bills show growth materially faster than DB size growth, check `R2DeletionJob` throughput and reconciler logs.

### R2 deletion DLQ runbook

- **Status**: Deferred — Phase 8 SUPERUSER console; runbook required before prod
- **Context**: `R2DeletionJob` with `attempts = 5` sets `dlqAt = now()` and alerts Sentry. Typical causes: bucket permissions drift, key already deleted manually, R2 region outage. The object may or may not still exist in R2.
- **Runbook (document before first prod launch)**: (1) Sentry alert links to the DLQ row in the SUPERUSER console. (2) Operator inspects the object in the R2 dashboard. (3) If object exists and is an orphan: delete manually in R2, mark the job `completedAt = now()` with reason note. (4) If object does not exist: mark `completedAt = now()` — the delete already happened. (5) If permission error: fix IAM, click "retry" which resets `attempts = 0, dlqAt = null`. Every action emits an audit event against the job's source org.

### Audit retention beyond 7 years

- **Status**: Deferred — Phase 8+
- **Context**: `AuditEvent` is append-only (`docs/architecture.md` §6.9) and retained indefinitely under a legal-records basis (§12). At SMB scale this is fine for years. A formal lifecycle policy is needed before the first compliance-gated customer signs.
- **Resolution when promoted**: partition `AuditEvent` by month (§6.10 already flags this); archive partitions older than 7 years to cold storage; emit a meta-audit event on archival. Clearing `Organization.legalHoldUntil` is a prerequisite, SUPERUSER-only, mandatorily audited.

---

## Operational & support

### Manual trial extension runbook

See **Billing & subscriptions → Trial extension for enterprise sales** for the MVP runbook workaround.

### Organization soft-delete cascade

See **Billing & subscriptions → Org soft-delete → Stripe subscription cascade**.

### Support-initiated manual reactivation

See **Billing & subscriptions → SUPERUSER manual override vs next Stripe webhook** for the invariant.

---

## Cross-references

- Engineering spec — [`docs/architecture.md`](./architecture.md) (§6.7 billing, §6.7.2 middleware, §6.9 audit, §6.11 retention & purge policy, §8 R2 storage, §12 audit retention)
- Build sequence — [`docs/implementation_checklist.md`](./implementation_checklist.md) (Phase 0 foundations + retention writer, Phase 3 R2 worker, Phase 5 retention purge cron, Phase 8 soft-delete purge + reconciler + SUPERUSER console)
- Product brief — [`docs/veracrew.md`](./veracrew.md) §4.1 trial flow

### Archived brainstorming list (superseded)

An older numbered “gap dump” lived below this line. **Do not use it as the source of truth.** Data lifecycle, retention, `purgeAfter`, audit/GDPR stance, FK `onDelete`, and R2 deletion jobs are decided in [`docs/implementation_plan_updates.md`](./implementation_plan_updates.md) and reflected in [`docs/architecture.md`](./architecture.md) / [`docs/implementation_checklist.md`](./implementation_checklist.md). Operational follow-through (backups, R2, email bounces) is tracked for implementation in [`context/features/phase-0-operations-email-storage.md`](../context/features/phase-0-operations-email-storage.md). Remaining themes (mobile UX edge cases, labor-law depth, WCAG, support tooling) should be added as **new tagged entries** in this file when triaged—not resurrected from the old list verbatim.

Any new route you add under these two prefixes inherits zero proxy protection. That means you are responsible for auth inside the route handler itself. For api/webhooks/*, that means always verifying the Stripe signature before doing anything. For api/crons/*, always checking x-cron-secret. Both routes already do this correctly.

If you ever add a third type of system-to-system route (e.g. /api/integrations/* for a third-party callback), the same pattern applies — exclude it from the proxy and secure it inside the handler with whatever credential that system sends.