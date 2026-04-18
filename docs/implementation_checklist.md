# Veracrew — Implementation Checklist

Working checklist for building Veracrew in phases. Each phase has a **Definition of Done (DoD)** gate; don't start the next phase until the previous phase's DoD passes.

Companion documents:
- Product vision: [`docs/veracrew.md`](./veracrew.md)
- Engineering spec + schema: [`docs/architecture.md`](./architecture.md)
- Edge cases + deferred items: [`docs/edge-cases.md`](./edge-cases.md)

Terminology: all platform-role mentions use `WORKER` (not `MEMBER`). Trade/pay roles are `JobRole`. Storage is always Cloudflare R2. Money is always integer cents. See `docs/architecture.md` §2.

**Phase 0 — agent feature specs** (slice order, decisions, guardrails): [`context/features/phase-0-index.md`](../context/features/phase-0-index.md)

---

## Phase 0 — Foundation (security-forward)

The longest phase. **Security + tenancy are built in from day one, not retrofitted.** Don't ship any user-facing feature until this phase passes.

### Infrastructure & dependencies

- [ ] PostgreSQL provisioned (Neon recommended); `DATABASE_URL` + pooled `DATABASE_URL_UNPOOLED` in env
- [ ] Prisma initialized; `prisma/schema.prisma` with all cross-cutting conventions (CUID IDs, `organizationId` on tenant-scoped tables, soft-delete allowlist, money as `Int` cents)
- [ ] Prisma migrations from day one; `prisma migrate dev` on local, `prisma migrate deploy` in CI
- [ ] Retention columns in schema from day one (see `architecture.md` §6.11): `Notification.purgeAfter`, `Message.purgeAfter`, `ActivityEvent.purgeAfter` (+ composite indexes paired with the existing tenant/thread indexes)
- [ ] Legal-hold columns in schema from day one: `Organization.legalHoldUntil`, `Organization.messageRetentionDays`, `Invoice.legalHoldUntil`, `TimeEntry.legalHoldUntil`
- [ ] `R2DeletionJob` model in schema (global ops table, not tenant-scoped, SUPERUSER-only access) — see `architecture.md` §6.7 / §6.11.3
- [ ] Every `@relation` in `schema.prisma` declares an explicit `onDelete` per the canonical matrix in `architecture.md` §6.11.5
- [ ] Extra `AuditAction` enum values seeded from day one: `USER_TOMBSTONED`, `ORG_LEGAL_HOLD_SET`, `RETENTION_PURGE`, `R2_OBJECT_DELETED`, `R2_ORPHAN_QUARANTINED`
- [ ] Cloudflare R2: buckets `veracrew-docs-{env}` and `veracrew-images-{env}` provisioned; access key pair; CORS configured for direct browser uploads
- [ ] Upstash Redis (or equivalent) provisioned for rate limits
- [ ] Resend API key; sender domain verified
- [ ] Stripe account; test & live keys; webhook endpoint configured
- [ ] Cloudflare Turnstile site + secret keys (dev + prod)
- [ ] Vercel project; env vars set per environment
- [ ] `.env.example` checked in with every variable Veracrew reads

### Database-level multi-tenant isolation

- [ ] Postgres **Row Level Security (RLS)** enabled on every tenant-scoped table
- [ ] RLS policies filter by `current_setting('app.current_org_id', true)::text`
- [ ] Separate app DB role with `BYPASSRLS = OFF`; migrations run under superuser role
- [ ] `withOrgRLS(organizationId, fn)` transaction wrapper that issues `SET LOCAL app.current_org_id = '…'` before running queries
- [ ] `SET LOCAL` value is SQL-escaped; value only comes from `requireOrgContext()`
- [ ] Verify behavior with PgBouncer / Neon pooler (transaction mode)
- [ ] Unit test: a deliberate query without the RLS context must fail / return empty

### App-layer tenancy helpers

- [ ] `src/lib/auth/context.ts` — `requireOrgContext()` that resolves session, re-verifies `Membership.status === "ACTIVE"`, and returns `{ userId, organizationId, role, jobRoleId, membershipId }`
- [ ] `requireRole(minRole, ctx)` — hierarchical check against `OWNER > ADMIN > MANAGER > WORKER`
- [ ] `assertOrgMembership(organizationId)` — validates on org-switch
- [ ] `src/lib/db/scoped-prisma.ts` — **`scopedPrisma(organizationId)`** auto-injects `organizationId` on every tenant-scoped model query
- [ ] `scopedPrisma` write extension populates `purgeAfter` at insert time for `Notification` (createdAt + 90d), `ActivityEvent` (createdAt + 545d), `Message` (createdAt + `Organization.messageRetentionDays ?? 730d`) — see `architecture.md` §6.11.1
- [ ] `scopedPrisma` write extension populates `legalHoldUntil` at insert time for `Invoice` and `TimeEntry` (createdAt + 7y) — value tunable via a `getLegalHoldDays(model, org)` helper so future rows can use a different window without migrating old rows
- [ ] `scopedPrisma` audit emitter redacts PII fields (`email`, `name`, `phone`, `image`, `locale`) in `AuditEvent.before` / `.after` to `"[redacted]"` — unit tested with a User update (see `architecture.md` §12)
- [ ] `scripts/lint-prisma-relations.ts` — CI lint that fails any PR introducing an `@relation(...)` without an `onDelete` attribute; run in the same CI step as `prisma validate`
- [ ] Central list of tenant-scoped models (single source of truth); CI test fails if a new model is added without updating the list
- [ ] Single-record fetches verify `record.organizationId === ctx.organizationId` (documented pattern)
- [ ] Error types: `UnauthorizedError`, `ForbiddenError`, `NoActiveOrgError`

### Auth

- [ ] NextAuth / Auth.js installed; Prisma adapter configured
- [ ] Email + password (Argon2id hashing, not bcrypt)
- [ ] Google OAuth provider
- [ ] **2FA (TOTP)**: enrollment flow, backup codes (10, hashed), verification on sign-in
- [ ] 2FA enforced for `OWNER` and `ADMIN` on first sign-in after promotion
- [ ] Session shape exposes `userId`, `organizationId`, `role`, `jobRoleId`, `membershipId`, `locale`
- [ ] Session rotation on: password change, 2FA enable/disable, role change, org switch
- [ ] Magic-link flow wired (used by invite-accept)
- [ ] Recovery procedure documented (2FA reset with identity verification + audit event)

### Validation & rate limiting

- [ ] Zod schemas for every server action input; helper that returns `ActionResult<T>`
- [ ] Every server action starts with `requireOrgContext` → `requireRole` → `zod.parse`
- [ ] Rate-limit scaffold (Upstash) with sensible defaults on: auth, invite-send, clock-in, upload presigned URL generation, download presigned URL generation
- [ ] Failed-auth counter per IP + per email; temporary lockout after N failures
- [ ] Webhook signature verification helpers for Stripe + Resend

### File upload security (heuristic defense for MVP)

- [ ] Server action `getUploadUrl()` — validates size cap + MIME allow-list, returns presigned PUT URL with R2 key `org_{orgId}/…`, short TTL
- [ ] Server action `finalizeUpload()` — HEAD-request the uploaded object, verify size, sniff MIME, magic-byte check, create DB row
- [ ] Extension blocklist (`.exe .bat .scr .dll .js .vbs .msi .jar .cmd .ps1 .sh`) rejected regardless of MIME
- [ ] Size caps: 25 MB images, 50 MB PDFs
- [ ] Server-generated UUID filenames; user-supplied names stored in DB only
- [ ] All download presigned URLs include `Content-Disposition: attachment`
- [ ] Download presigned URL generation emits `AuditEvent` with `action = DOC_DOWNLOAD`
- [ ] `UserDocument.scanStatus` field defaults `CLEAN` for MVP; code path ready for future `PENDING → CLEAN | QUARANTINED` flow

### Audit trail

- [ ] `AuditEvent` model in schema
- [ ] Emit pattern baked into `scopedPrisma` (Prisma `$use` middleware or `$extends` query extension) — every mutating write on a tenant-scoped model emits one row
- [ ] Extra emit points: login, logout, role-change, 2FA enable/disable, invite send/accept/revoke, payroll export
- [ ] PII redaction in audit diffs verified by adversarial test (update a User's email → resulting `AuditEvent.after.email === "[redacted]"`)

### Privacy notice & user tombstoning

- [ ] Plain-language privacy notice shipped at signup and in `/settings` stating: (a) retention windows for messages/notifications/activity, (b) 7-year retention of payroll + invoicing under legal basis, (c) user deletion = tombstone (id preserved, PII removed) to honor statutory records — see `architecture.md` §6.11.4 and §12
- [ ] Tombstone helper `tombstoneUser(userId)` implemented per `architecture.md` §6.11.4 (writes `former-worker-<last4>` name + `tombstone+<id>@veracrew.invalid` email, nulls out image/phone/locale); cron wiring deferred to Phase 8 but helper is unit-tested from Phase 0

### Security headers

- [ ] CSP (strict-dynamic or hash/nonce for inline)
- [ ] HSTS (1y + preload once verified)
- [ ] X-Frame-Options: DENY
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] X-Content-Type-Options: nosniff
- [ ] Permissions-Policy (geolocation allowed for clock-in page only; microphone/camera denied)
- [ ] All headers in `next.config.js`; verified via a curl test in CI

### App shell & i18n

- [ ] Root layout with shell: sidebar (Dashboard, Team, Locations, Schedule, Jobs, Documents, Time Tracking, Reports, Settings), header (org switcher placeholder, notification bell, user menu)
- [ ] `(dashboard)` route group for authenticated pages
- [ ] `next-intl` integrated; locale routing `/en/*` and `/fr/*`
- [ ] Message catalog scaffolded; EN + FR starter bundles (UI chrome only in Phase 0)
- [ ] Locale resolution: URL → `User.locale` → `Organization.defaultLocale` → `"en"`

### PWA scaffold

- [ ] `manifest.webmanifest` with icons (maskable + regular), theme color, name, start URL
- [ ] Workbox-based service worker; caches app shell, network-first for data
- [ ] Service worker cache versioned; old caches purged on update
- [ ] `workbox-window` client registration from `layout.tsx`
- [ ] IndexedDB wrapper (e.g. `idb-keyval`) available; empty queue shape defined
- [ ] Background Sync API feature-detected (graceful degradation on iOS)

### Stripe scaffold

#### Schema + enums

- [ ] `PlanKey` enum in Prisma schema (`STARTER | GROWTH | SCALE`); `OrgSubscription.planKey` defaults to `STARTER` as the safety floor (real value always set via `resolvePlanKey(stripePriceId)`)
- [ ] `OrgStatus` enum in Prisma schema (`TRIALING | ACTIVE | PAST_DUE | TRIAL_EXPIRED | CANCELLED | SUSPENDED`); `Organization.status` defaults to `TRIALING`
- [ ] `Organization.stripeCustomerId String? @unique` migrated
- [ ] `OrgSubscription` expanded: `stripePriceId`, `trialEndsAt`, `currentPeriodEnd`, `cancelAtPeriodEnd` (default false), `hasPaymentMethod` (default false), `requiresPaymentAction` (default false, flipped by SCA webhook) all migrated
- [ ] `StripeWebhookEvent { id, type, receivedAt, processedAt, payload }` dedupe table migrated; `id` is Stripe's `event.id` (not a cuid)
- [ ] `AuditAction` enum extended with billing values (`SUBSCRIPTION_TRIAL_STARTED`, `SUBSCRIPTION_PAYMENT_METHOD_ADDED`, `SUBSCRIPTION_PAYMENT_METHOD_DETACHED`, `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_PAYMENT_FAILED`, `SUBSCRIPTION_PAST_DUE`, `SUBSCRIPTION_TRIAL_EXPIRED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_REACTIVATED`, `SUBSCRIPTION_PLAN_CHANGED`, `ORG_STATUS_CHANGED`, `ORG_REACTIVATE_MANUAL`, `TRIAL_EXTENDED`) — see `architecture.md` §6.9 for fan-out table to `ActivityEvent`

#### Plan limits + tier gating stubs (unchanged from prior plan, now enumerated here)

- [ ] `src/lib/billing/plan-limits.ts` scaffolded: `PLAN_LIMITS` populated for `STARTER` (real caps); `GROWTH` and `SCALE` entries present with TODO comments and placeholder caps matching `docs/veracrew.md` §9.1
- [ ] `requireFeature(flag, ctx)` and `requireWithinLimit(resource, ctx)` no-op stubs exported from `src/lib/billing/`; typed `PlanLimitError` class defined
- [ ] Both helpers imported (but not yet enforcing) in server actions that will gate on tier in Phase 8: scheduler create, location create, invoice create, starter pack upload, audit export
- [ ] Unit test confirms both stubs return without throwing on every `PlanKey` (keeps Phase 8 flip safe)

#### Price → PlanKey mapping (moved from Phase 8)

- [ ] `src/lib/billing/plan-mapping.ts` — `resolvePlanKey(stripePriceId): PlanKey`; env-aware (`STRIPE_MODE = test | live`); separate maps per env
- [ ] MVP ships with the `GROWTH` price ID populated in both test and live maps; `STARTER` and `SCALE` entries added in Phase 8
- [ ] Unknown `stripePriceId` throws `UnknownPlanPriceError` and reports to Sentry — never silently defaults to `STARTER`
- [ ] Unit test: each known price id resolves; unknown id throws; cross-env lookup (test id in live map) throws

#### Webhook handlers (signature-verified + idempotent)

- [ ] `app/api/webhooks/stripe/route.ts` verifies Stripe signature **before** any DB mutation or side effect
- [ ] Every handler inserts into `StripeWebhookEvent` keyed on `event.id` inside the same transaction as its domain mutation; unique-violation exits cleanly
- [ ] `checkout.session.completed` → store `stripeCustomerId` + `stripeSubscriptionId`, set `hasPaymentMethod = true`
- [ ] `customer.subscription.created` → upsert `OrgSubscription`, set `planKey` via `resolvePlanKey`, transition `Organization.status` (`→ TRIALING` for new trial, `→ ACTIVE` for skip-trial Pattern A)
- [ ] `customer.subscription.updated` → sync all Stripe-mirrored fields, re-resolve `planKey`, mirror status (`trialing → active`, `active → past_due`, `past_due → active`, `trialing → past_due` when the day-14 auto-charge fails mid-transition)
- [ ] `customer.subscription.trial_will_end` → queue reminder email (suppressed if `hasPaymentMethod = true`)
- [ ] `payment_method.detached` → flip `hasPaymentMethod = false`; un-suppress the trial reminder email if the trial is still live; emit `SUBSCRIPTION_PAYMENT_METHOD_DETACHED`
- [ ] `invoice.payment_action_required` (SCA / 3DS) → flip `OrgSubscription.requiresPaymentAction = true`; queue "your bank needs authentication" email with the Stripe hosted authentication URL; render in-app banner on `(dashboard)` layout; no `Organization.status` transition
- [ ] `invoice.payment_succeeded` → primary reactivation path (`PAST_DUE | TRIAL_EXPIRED → ACTIVE`, `TRIALING → ACTIVE` on first real charge); clears `requiresPaymentAction`
- [ ] `invoice.payment_failed` → `ACTIVE → PAST_DUE` (existing paying customer) OR `TRIALING → PAST_DUE` (day-14 auto-charge failed; Stripe still has retries, do **not** jump to `TRIAL_EXPIRED`); queue "payment failed" email; clears `requiresPaymentAction`
- [ ] `customer.subscription.deleted` → `→ CANCELLED`
- [ ] Every handler emits an `AuditEvent` on status transitions; ActivityEvent fan-out per `architecture.md` §6.9 table

#### Cron-driven transitions (not from Stripe)

- [ ] Cron: `TRIALING + trialEndsAt < now + no payment → TRIAL_EXPIRED` (fires the trial-expired email). Schedule at **00:00 UTC daily**; query filter is `trialEndsAt < now()`, **not** `trialEndsAt = today` (catches orgs whose crons missed a prior run). See `architecture.md` §6.7.3.
- [ ] Cron: `PAST_DUE entered >= 7d ago + still PAST_DUE → TRIAL_EXPIRED` (hard cap on dunning limbo). Same 00:00 UTC schedule.
- [ ] UI renders `trialEndsAt` in `Organization.timezone` with an explicit local timestamp (e.g. `"Nov 14 at 11:59 PM ET"`) so the UTC boundary is invisible; document the formatter helper in `src/lib/format/datetime.ts`
- [ ] Both crons audit-log their transitions

#### Org-activity middleware (live from Phase 0)

- [ ] `src/lib/auth/org-status.ts` — `requireOrgActive(ctx)` reads `Organization.status` fresh from DB, allows `TRIALING | ACTIVE | PAST_DUE`, throws `OrgInactiveError` otherwise
- [ ] `OrgInactiveError` class in `src/lib/errors.ts` carrying `{ status, organizationId }`; sibling of `PlanLimitError` and `ConflictError`
- [ ] Every mutating server action template: `requireOrgContext → requireOrgActive → requireRole → zod.parse → scopedPrisma` — order enforced in code review checklist
- [ ] `closeOpenTimeEntry(ctx, timeEntryId)` carveout: bypasses `requireOrgActive` for `TRIAL_EXPIRED` and `CANCELLED` only (never `SUSPENDED`). Unit test covers the carveout path.
- [ ] `billingPortalRedirect(ctx)` and `reactivateCheckout(ctx)` callable from `TRIAL_EXPIRED` + `CANCELLED` (not `SUSPENDED`) so admins can actually pay
- [ ] Unit test: every non-carveout mutating action throws `OrgInactiveError` when status is `TRIAL_EXPIRED`; reads still succeed

#### Manual reactivation (support edge cases)

- [ ] `SUPERUSER`-only server action `manuallyReactivateOrg(ctx, organizationId, reason)`: flips `Organization.status` to `ACTIVE`, writes `AuditEvent` with action `ORG_REACTIVATE_MANUAL` + reason + support agent id
- [ ] Route is gated outside the normal org-scoped RBAC (Veracrew staff only, not customer `OWNER` / `ADMIN`)

#### Billing emails (templates + queue integration)

- [ ] Trial-expired email template (EN + FR): "your trial ended, org is read-only, reactivate here"
- [ ] Welcome-to-paid email template (EN + FR): sent on `invoice.payment_succeeded` transitions to `ACTIVE`; includes next renewal date, amount, cancel-anytime link
- [ ] Payment-failed email template (EN + FR): sent on `invoice.payment_failed`; includes red-banner context + update-card link
- [ ] Trial-will-end email template (EN + FR): triggered by the `customer.subscription.trial_will_end` webhook; suppressed if `hasPaymentMethod = true`
- [ ] Payment-method-added confirmation email (EN + FR): optional, sent from `checkout.session.completed` when `hasPaymentMethod` flips to true

### Cloudflare Turnstile

- [ ] Widget component (`@marsidev/react-turnstile` or equivalent)
- [ ] Server-side verification helper hitting Cloudflare's endpoint
- [ ] Rendered on: future signup page, future invite-accept page, any future public form
- [ ] Test site keys used in non-prod environments

### DoD — Phase 0

- [ ] A new org can be created via a test script; `Membership` exists with `role = OWNER`; `Organization.status = TRIALING`
- [ ] An adversarial test that attempts to read another org's `Organization` row with the wrong `app.current_org_id` returns zero rows (RLS denial)
- [ ] A server action without `requireOrgContext` fails lint (custom rule or review checklist)
- [ ] A mutating server action without `requireOrgActive` fails lint (same rule extended)
- [ ] Presigned upload + finalize pipeline works end-to-end against real R2 bucket
- [ ] All security headers pass a scan (e.g. securityheaders.com A+)
- [ ] Login on a fresh admin account forces 2FA enrollment before any other action
- [ ] Turnstile gate blocks an automated signup attempt
- [ ] Stripe webhook endpoint rejects unsigned / malformed events with 400 and emits no side effects
- [ ] Stripe webhook replay (same `event.id` delivered twice) runs the domain handler exactly once — `StripeWebhookEvent` insert is the dedupe gate
- [ ] `resolvePlanKey` unit test: known price resolves; unknown id throws `UnknownPlanPriceError` + Sentry report; test-mode id fed to live-mode lookup throws
- [ ] Middleware unit test: `requireOrgActive` allows `TRIALING | ACTIVE | PAST_DUE`; throws `OrgInactiveError` for `TRIAL_EXPIRED | CANCELLED | SUSPENDED`; `closeOpenTimeEntry` carveout bypasses for `TRIAL_EXPIRED | CANCELLED` only
- [ ] CI runs: typecheck, lint, Vitest, `prisma validate`, `scripts/lint-prisma-relations.ts`, `prisma migrate diff --from-schema-datamodel` is clean
- [ ] `scopedPrisma` writer test: inserting a `Notification` sets `purgeAfter = createdAt + 90d ± 1s`; inserting a `Message` for a SCALE org with `messageRetentionDays = 30` sets `purgeAfter = createdAt + 30d`; inserting a `TimeEntry` sets `legalHoldUntil = createdAt + 7y`
- [ ] `lint-prisma-relations.ts` fails a synthetic PR that adds a new `@relation` without `onDelete`

---

## Phase 1 — Org, invites, onboarding

### Org creation

- [ ] Owner signup → forced 2FA enrollment → "Create your organization" page (name, country, timezone auto-detected, currency, default locale)
- [ ] Creates `Organization` + `Membership` with `role = OWNER`
- [ ] Sets session `organizationId` to the new org

#### Stripe trial provisioning (same transaction as org creation)

- [ ] Stripe Customer created synchronously on org creation; `Organization.stripeCustomerId` stored
- [ ] Stripe Subscription created with the MVP Growth `price_id` and `trial_end = now + 14 days`; no card required
- [ ] `OrgSubscription` row written: `status = "trialing"`, `planKey = resolvePlanKey(priceId)` (= `GROWTH`), `trialEndsAt = now + 14d`, `hasPaymentMethod = false`
- [ ] `Organization.status = TRIALING`
- [ ] Audit events: `ORGANIZATION_CREATED`, `SUBSCRIPTION_TRIAL_STARTED`
- [ ] If Stripe Customer or Subscription creation fails, the whole org-creation transaction rolls back (no orphan Organization rows)

### Billing settings page (MVP)

- [ ] `/settings/billing` route, `ADMIN+` only
- [ ] Shows current state: plan name, trial countdown (if trialing), next renewal date, payment method status, Stripe invoice history
- [ ] Primary CTA **"Add payment method"** (Pattern B, default) — opens Stripe Checkout in subscription mode with `trial_end` preserved
- [ ] Secondary link **"Pay in full today and skip the trial"** (Pattern A) — updates subscription `trial_end = now`, triggers immediate charge
- [ ] "Reactivate" CTA visible only when `Organization.status = TRIAL_EXPIRED` or `CANCELLED` — opens Stripe Checkout
- [ ] Cancel-subscription CTA (requires confirmation + reason): behaviour depends on current `Organization.status` per `architecture.md` §6.7.3 cancel table — `TRIALING` / `PAST_DUE` / `TRIAL_EXPIRED` → immediate `stripe.subscriptions.cancel` → `Organization.status = CANCELLED`; `ACTIVE` → `cancel_at_period_end = true`, keep access until `currentPeriodEnd`, webhook flips status then
- [ ] Banner at top of `(dashboard)` layout: trial countdown when `TRIALING` + no card (dismissible per session, re-appears on day 7); red payment-failed banner when `PAST_DUE`; read-only banner when `TRIAL_EXPIRED`

### Trial reminder email wiring

- [ ] `customer.subscription.trial_will_end` webhook handler enqueues the "trial ends in 3 days" email to all `OWNER` + `ADMIN` memberships of the org
- [ ] Email suppressed entirely if `OrgSubscription.hasPaymentMethod = true` at the moment the webhook fires
- [ ] Integration test: with test-mode Stripe, advance the test clock to `trial_end - 3d`, verify the webhook fires and the email queues (or is suppressed when a card is on file)

### Invite flows (two-track)

- [ ] `inviteWorker` action: `MANAGER+` can call; creates `Invite` with `role = WORKER`, optional `jobRoleId`
- [ ] `inviteAdminOrManager` action: `OWNER` / `ADMIN` only; creates `Invite` with `role = ADMIN | MANAGER`
- [ ] Single-use token, 7-day expiry (configurable), revocable
- [ ] Resend email in the inviter's locale (or recipient's locale if previously known)
- [ ] Partial unique index enforced (no duplicate pending invites for same email+org)
- [ ] Accept page: Turnstile gate → sign up or sign in → creates `Membership`, marks `Invite.acceptedAt`
- [ ] Revoke invite action (`MANAGER+`), emits audit event

### Onboarding wizard

- [ ] Step 1: Org essentials (post-signup) — see above
- [ ] Step 2: First location — address field → geocode (Google Maps Geocoding API or alternative) → confirm pin, set radius
- [ ] Step 3: Pick doc templates — choose a **starter pack** (e.g. Canadian construction basic, residential cleaning) OR upload custom templates OR skip
- [ ] Step 4: Invite teammates — email + role picker + optional trade (JobRole)
- [ ] "Skip for now" on steps 2–4; land on empty-state dashboard with "next best action" cards

### Team Members page

- [ ] Table with: avatar, name, email, role (platform), JobRole (trade), status, primary location (MVP: optional field)
- [ ] Search + filter by role / status / JobRole
- [ ] Row actions (per RBAC): change role, change JobRole, suspend/reactivate, remove from org (soft)
- [ ] Bulk invite action
- [ ] Pending invites list with revoke action

### JobRole management

- [ ] `Settings → Trades (JobRole)` page; `ADMIN+` CRUD
- [ ] Each has `name` + `defaultRegularRateCents`
- [ ] `Membership.hourlyRateOverrideCents` UI on the team page

### DoD — Phase 1

- [ ] Owner can go from signup to "2 workers invited and in the org" in under 5 minutes
- [ ] Worker clicks invite email in a fresh browser, passes Turnstile, completes signup, lands in the org as `WORKER`
- [ ] Revoked invite cannot be accepted; returns friendly error
- [ ] All invite-related writes produce audit entries
- [ ] Unit tests: invite expiry, single-use enforcement, role-escalation blocked (a `MANAGER` cannot call `inviteAdminOrManager`)

#### Trial + billing acceptance tests (all against Stripe test-mode with a Test Clock)

- [ ] Happy-path signup: new org created, `Organization.status = TRIALING`, `OrgSubscription.status = "trialing"`, `planKey = GROWTH`, `trialEndsAt = +14d`, audit events emitted
- [ ] Pattern B (default): mid-trial add payment method → `OrgSubscription.hasPaymentMethod = true`, status still `trialing`, advance test clock 14 days → `invoice.payment_succeeded` fires → `Organization.status = ACTIVE`, reminder email was **suppressed**
- [ ] Pattern A (secondary): mid-trial click "Pay in full today and skip the trial" → immediate charge → `Organization.status = ACTIVE` same-day, forfeited trial days confirmed
- [ ] Trial expiry (no card): advance test clock past `trialEndsAt` with no payment method → cron flips `Organization.status = TRIAL_EXPIRED` → test mutating action (create job) throws `OrgInactiveError` → test read action (list workers) still succeeds → test `closeOpenTimeEntry` on a pre-existing open entry succeeds
- [ ] Reactivation from `TRIAL_EXPIRED`: complete Stripe Checkout → `invoice.payment_succeeded` webhook → `Organization.status = ACTIVE` → mutating action now succeeds → prior data fully intact
- [ ] Past-due dunning: simulate `invoice.payment_failed` → `Organization.status = PAST_DUE` → red banner renders → writes still succeed in the 7-day window → cron after 7d flips to `TRIAL_EXPIRED` if no payment
- [ ] Webhook replay: fire same `invoice.payment_succeeded` event twice → handler runs once, second call exits on `StripeWebhookEvent` unique-violation, no double-transition
- [ ] Cross-tenant: webhook for org A's subscription never touches org B's `Organization.status`; adversarial test forges a webhook with org B's `stripeCustomerId` but org A's `subscription_id` → signature verification fails or customer-mismatch rejection logged
- [ ] Trial reminder suppression: `customer.subscription.trial_will_end` with `hasPaymentMethod = true` → no email queued; same event with `hasPaymentMethod = false` → email queued to all `OWNER` + `ADMIN` memberships
- [ ] Unknown price id: handler receives `customer.subscription.updated` with a Stripe `price.id` not in `PRICE_ID_TO_PLAN_KEY` → throws `UnknownPlanPriceError`, reports to Sentry, does not silently default to `STARTER`

---

## Phase 2 — Compliance & documents

### Template library

- [ ] `DocumentTemplate` CRUD (`MANAGER+`): name, description, required flag, `expiryMonths`, `jobRoleIds[]` for per-trade scoping, optional blank-form file upload
- [ ] Starter-pack loader: selecting a pack during onboarding creates templates with `isStarterPack = true` and `starterPackKey` set
- [ ] Starter-pack content: first two packs prepared as a content task (Canadian construction basic; residential cleaning) — note: actual PDFs are a content deliverable, not code

### Worker submission flow

- [ ] Worker dashboard "My documents" section shows required templates + status per template
- [ ] Upload via presigned URL → `finalizeUpload` → `UserDocument` row `SUBMITTED`
- [ ] Approver view (`MANAGER+`): inbox of `SUBMITTED` docs, approve / reject (with reason)
- [ ] On approve: set `approvedAt`, `approvedById`; compute `expiresAt` from `template.expiryMonths`
- [ ] On reject: set `rejectionReason`, status stays visible to worker with "resubmit"

### Expiry & reminders

- [ ] Query: "expiring within N days" per user per template
- [ ] Background job (cron): daily scan; fans out `Notification` rows + Resend email for docs expiring in 30/14/7 days and expired
- [ ] Worker and their managers notified; urgent severity for expired

### Documents page (admin)

- [ ] Summary cards: approved / pending / expired+rejected
- [ ] Tabs: Templates, Pending Approvals, By Worker
- [ ] Bulk approve (with confirm)

### DoD — Phase 2

- [ ] Worker can upload a blank form, manager approves, expiry is computed, reminder fires at 30 days out
- [ ] Expired docs show correctly on the worker dashboard
- [ ] Per-trade scoping works (worker with `JobRole = Apprentice` only sees WHMIS requirement, not COR)
- [ ] Starter pack on onboarding creates the expected templates

---

## Phase 3 — Locations & geofenced time

### Locations

- [ ] `Location` CRUD (`MANAGER+`) with address → geocoded lat/lng; manual override allowed
- [ ] Radius slider (default 100m)
- [ ] Per-site timezone (auto-detected from lat/lng via a tz lookup lib, e.g. `@vvo/tzdb`)
- [ ] Active/inactive toggle

### Time tracking (online-first path)

- [ ] Clock-in action: session → `requireOrgContext` → resolve active `ShiftAssignment` or `JobAssignment` at the requested location → Haversine gate → create `TimeEntry`
- [ ] Break start/end actions
- [ ] Clock-out action; computes `submittedAt` once clocked out
- [ ] Time immutable after `submittedAt` is set (manager edit creates a new row with `source = MANAGER_EDIT` or mutates with approval — decision: **approval path on existing row with audit diff**)

### PWA offline queue

- [ ] IndexedDB queue for clock events (in/out/break-start/break-end) with device-generated `eventUuid`, client timestamp, captured GPS + accuracy, `deviceUuid` (stable per install)
- [ ] Background Sync registered; replay on reconnect
- [ ] Server action dedupe via `@@unique([deviceUuid, clockIn])` (Prisma migration) — conflict → treat as already-processed
- [ ] Clock-drift rejection: `|clientTimestamp - serverTimestamp| > 2h` → reject with friendly UI
- [ ] Geofence validated against **captured** GPS (not replay-time)
- [ ] Flagging: `flaggedReason` populated for out-of-radius, low accuracy (>200m), device-collision, impossible-travel

### Suspicious-pattern jobs

- [ ] Weekly scan for `deviceUuid` used by >1 `Membership` in a short window → admin notification
- [ ] Flagged entries surface on admin dashboard "Needs action"

### Time Tracking page

- [ ] Filter by date range, worker, location, status (pending / flagged / approved)
- [ ] Row detail: full event timeline (clocks + breaks + edits)
- [ ] Manager approval action for flagged entries
- [ ] Export CSV (MVP stub; proper export in Phase 6)

### R2 deletion worker

- [ ] `src/jobs/processR2Deletions.ts` — polls `R2DeletionJob` every 2 min, deletes from R2 with up-to-5-attempt exponential backoff (1m / 5m / 30m / 2h / 12h), sets `completedAt` on success or `dlqAt` after exhaustion — see `architecture.md` §8 + §6.11.3
- [ ] Hard-delete code paths (UserDocument admin delete in Phase 2, finalizeUpload rollback in Phase 0) enqueue `R2DeletionJob` inside the same Prisma transaction as the row delete — not a best-effort after-write
- [ ] `R2_OBJECT_DELETED` audit event emitted on successful delete; DLQ alert integrated with Sentry (Phase 8 SUPERUSER console drains it)

### Web Push

- [ ] Subscription on first clock-in prompt (permission ask)
- [ ] Stored per `Membership`
- [ ] Shift-reminder notification scheduled via cron 30 min before scheduled start

### Dashboard KPIs (wired)

- [ ] "Clocked in right now" count
- [ ] "Hours this week" (rough sum; full payroll math in Phase 6)
- [ ] "Pending documents / expiring soon" counts from Phase 2 data

### DoD — Phase 3

- [ ] Worker on a phone, airplane-mode ON, taps Clock In → event queues → airplane mode off → syncs → server creates entry with captured GPS
- [ ] Clock-drift > 2h on replay → rejected with UI message
- [ ] Device collision test (two memberships, same `deviceUuid`) → both flagged, admin notified
- [ ] Haversine correctness unit-tested against known coordinates (including the 180° meridian edge case)

---

## Phase 4 — Scheduler (shifts + jobs)

### Shifts

- [ ] `Shift` CRUD: location, recurrence (iCal `RRULE`), local start/end time, optional `JobRole`, effective window
- [ ] `ShiftAssignment` CRUD with effective window
- [ ] Worker dashboard "Upcoming schedule" reads from shifts + explicit job assignments

### Jobs

- [ ] `Client` + `Project` CRUD (`MANAGER+`)
- [ ] `Job` CRUD: title, description, client, optional project, optional location, scheduled window, status
- [ ] `JobAssignment` CRUD
- [ ] `JobRequiredDocument` editor on job form: pick templates, mark `type` (fill-out / reference / pre-existing required), set `dueBefore` gate (clock-in / shift-end), attach one-off uploads

### Assignment email

- [ ] On assignment: send Resend email to each worker with job details + signed download links for any `REFERENCE` / `FILL_OUT` docs
- [ ] Deep link to job page in the app

### Clock-in gating

- [ ] Clock-in action extended: for the worker's current `JobAssignment` at this location, check all `JobRequiredDocument` rows with `dueBefore = CLOCK_IN`
- [ ] `PRE_EXISTING_REQUIRED` → worker must have an `APPROVED` `UserDocument` with matching template (and non-expired)
- [ ] `FILL_OUT` → worker must have submitted a `UserDocument` for this `jobAssignmentId`
- [ ] `REFERENCE` → no submission gate, but requirement displayed
- [ ] Per-org policy: `HARD_BLOCK` → refuse clock-in; `SOFT_WARNING` → allow with flag + manager notification
- [ ] Manager override action for specific incidents (`requireRole MANAGER`) — audit logged

### Teams

- [ ] `Team` + `TeamMember` models migrated; RLS policies added to both tables; soft-delete honoured on `Team` (historic `sourceTeamId` still resolves)
- [ ] Audit events: `team.created`, `team.updated`, `team.soft-deleted`, `team.member-added`, `team.member-removed`
- [ ] `Team` CRUD server actions (`MANAGER+`): name (unique per org), description, optional default `Location`, optional default `JobRole`, active toggle
- [ ] `TeamMember` add/remove actions; duplicate guard via `@@unique([teamId, userId])`; only workers who are active `Membership` rows in the org can be added
- [ ] `Teams` index page: list active teams, search by name, row expansion showing member avatars; "New team" modal (`MANAGER+`)
- [ ] Team detail page: editable member list, `roleOnTeam` label per member, action "assign this team to a job" that opens a job picker

### Conflict detection

- [ ] `Organization.conflictPolicy` column migrated; default `WARN`; `Settings → Scheduling` admin page exposes the toggle (`ADMIN+` only)
- [ ] `rrule` npm dependency added; `expandShiftOccurrences(shiftId, windowStart, windowEnd)` helper in `src/lib/scheduling/shift-occurrences.ts` respecting location timezone + DST + shifts crossing midnight + effective window bounds
- [ ] `detectWorkerConflicts(ctx, userIds, window, opts)` helper in `src/lib/scheduling/conflicts.ts`; sources default `["JOB", "SHIFT"]`; `TIME_OFF` branch implemented but gated behind `RUNTIME_FLAGS.conflictCheckIncludesTimeOff`
- [ ] `ConflictError` class in `src/lib/errors.ts`; typed `CommitmentWindow` / `ConflictReport` in `.utils/types/index.ts`
- [ ] `assignTeamToJob` server action: enforces `Organization.conflictPolicy`, creates `JobAssignment` rows with `sourceTeamId` seeded, writes `conflictOverridden` + `conflictOverrideReason` per override; single transaction; audit events `team.assigned-to-job` + `assignment.conflict-override` per overridden user
- [ ] `resyncTeamOnJob(teamId, jobId)` server action (never auto-runs): diffs current `TeamMember` list against existing `JobAssignment` rows with that `sourceTeamId`; confirms add/remove with the scheduler
- [ ] `addWorkerToJob(userId, jobId)` action (single-user path) reuses the same conflict helper + policy logic as `assignTeamToJob`
- [ ] `updateJobSchedule(jobId, newStart, newEnd)` re-runs the detector against existing `JobAssignment` rows; surfaces conflicts for the scheduler to resolve before persisting
- [ ] `updateShiftAssignment(id, effectiveFrom, effectiveTo)` re-runs the detector for the one affected user

### Scheduler UI

- [ ] Week view (shifts overlay + job assignments)
- [ ] Drag-to-assign workers to shifts (runs `detectWorkerConflicts` inline; respects `Organization.conflictPolicy`)
- [ ] Job detail "Assign team" button → team picker → conflict review modal: one row per conflicted member with the clashing `CommitmentWindow` label + times; per-person "proceed anyway" toggle, gated on `ADMIN+` when policy = `BLOCK`, available to `MANAGER+` when policy = `WARN`; optional reason textarea
- [ ] Assignment provenance badge on job detail: `from Team <name>` with "Re-sync team" action for the originating team
- [ ] Warning banner on any job whose `JobAssignment` rows include `conflictOverridden = true`

### TimeOffRequest (schema stub)

- [ ] `TimeOffRequest` model + `TimeOffStatus` enum migrated (schema only, RLS policy added, no UI, no enforcement in MVP). Rationale: locked now so the shape doesn't shift when Phase 8 enables the feature
- [ ] `src/lib/feature-flags.ts` added with `RUNTIME_FLAGS.conflictCheckIncludesTimeOff = false`; distinct from plan-tier flags in `src/lib/billing/plan-limits.ts`

### JobActivity (worker uploads on a job)

- [ ] `JobActivity` CRUD for workers assigned to the job
- [ ] Types: `ISSUE` (with `status` open/resolved), `NOTE`, `IMAGE`
- [ ] Manager dashboard: open-issue count per job; quick-resolve action

### DoD — Phase 4

- [ ] Manager creates a job with two required docs (one `FILL_OUT`, one `PRE_EXISTING_REQUIRED`), assigns a worker
- [ ] Worker receives email with signed links
- [ ] Worker tries to clock in without submitting the `FILL_OUT` → blocked (hard) or flagged (soft)
- [ ] Worker submits + manager approves → worker clocks in successfully
- [ ] Issue reported from the field shows up on the manager's dashboard with push notification
- [ ] Manager creates a Team with four workers and assigns it to a Job in one click; four `JobAssignment` rows are created with `sourceTeamId` set; audit event recorded
- [ ] Adversarial overlap: scheduler tries to assign a worker already on a Shift occurrence overlapping the Job window. With `Organization.conflictPolicy = BLOCK`, action fails with `ConflictError`. With `conflictPolicy = WARN`, action succeeds, row has `conflictOverridden = true`, audit entry records the override
- [ ] Adjacency: worker finishing Job A at 12:00 can be assigned to Job B starting at 12:00 with no conflict flagged
- [ ] Cross-tenant: `detectWorkerConflicts` invoked with a `userId` from a different org returns an empty `ConflictReport`, does not leak existence, RLS denial logged

---

## Phase 5 — Notifications, activity, messaging

### Data & feed

- [ ] `ActivityEvent` emitted on all product-meaningful writes (jobs created/updated, assignments, approvals, clock events, doc events, invoice events)
- [ ] Dashboard "Recent Activity" widget reads from `ActivityEvent`

### Notifications

- [ ] `Notification` row creation on key events (fan-out to participants/managers)
- [ ] In-app bell component with unread count
- [ ] Mark read (single + bulk)
- [ ] Severity-based styling
- [ ] Email (Resend) only for urgent severity + specific kinds (invite, expiring doc, expired doc, urgent message, shift reminder)
- [ ] Web Push for urgent + direct messages
- [ ] Deep link from notification → resource page

### Messaging

- [ ] `MessageThread` + `ThreadParticipant` + `Message` CRUD
- [ ] Thread creation policy enforced server-side:
  - `MANAGER+` can create `DIRECT` with any worker, `MANAGER_GROUP` with explicit participant list
  - `WORKER` can create `DIRECT` to a `MANAGER+` only
  - `WORKER` cannot create `MANAGER_GROUP`
- [ ] Worker "message my manager" entry point (resolves default manager or picker if multiple)
- [ ] Thread page: paginated messages, compose, `lastReadAt` updated on view
- [ ] On new message: fan-out `Notification` to other participants, gated by preferences (fixed rules in MVP)
- [ ] Small attachments on messages (reuse R2 upload pipeline; same validation)

### Retention purge cron

- [ ] `src/jobs/purgeRetentionExpired.ts` — nightly cron that hard-deletes `Notification`, `ActivityEvent`, `Message` rows whose `purgeAfter <= now()` in 1000-row batches, per-org, skipping orgs where `Organization.legalHoldUntil` is future-dated — see `architecture.md` §6.11.1
- [ ] One `RETENTION_PURGE` `AuditEvent` per org per model per run with `{ deletedCount, oldestPurgeAfter }` in the `after` payload
- [ ] Unit test: a Notification with `purgeAfter` in the future is not purged; one in the past is; an org under legal hold skips all three models

### DoD — Phase 5

- [ ] Unread count on bell is accurate under concurrent writes (test with two tabs)
- [ ] Worker cannot create a group thread; attempt returns 403
- [ ] Cross-tenant thread access blocked (adversarial test)
- [ ] Urgent notification triggers email AND push, normal triggers in-app only
- [ ] Retention purge cron: seed a test org with notifications whose `purgeAfter` is 1 day ago → run cron → rows are gone → `RETENTION_PURGE` audit event exists with correct count

---

## Phase 6 — Pay rules & payroll export

### PayRule engine

- [ ] `PayRule` CRUD (`ADMIN+`): set `effectiveFrom`, daily + weekly OT thresholds (both optional), OT multiplier (bps), double multiplier (bps, optional), holiday multiplier (bps)
- [ ] Append-only; new rule closes the previous (`effectiveTo`); cannot backdate to before any existing `TimeEntry`
- [ ] `Holiday` CRUD (`ADMIN+`): date + name

### Math

- [ ] `classifyMinutes(timeEntries, payRule, holidays, timezone)` pure function in `src/lib/payroll/classify.ts`
- [ ] Daily OT first, then weekly cap on top
- [ ] Holiday precedence: holiday multiplier applies to all minutes that day; OT thresholds disabled that day (MVP default)
- [ ] Mid-period rule change correctly splits entries by effective window
- [ ] Shifts crossing midnight split by day for daily OT
- [ ] Shifts crossing DST handled via location timezone

### Per-worker pay resolution

- [ ] Function `resolveHourlyRateCents(membership, jobRole)` → `membership.hourlyRateOverrideCents ?? jobRole.defaultRegularRateCents`
- [ ] Totals computed in integer cents × minute × multiplier (bps) / 10000 / 60

### Reports page

- [ ] Timeframe filter
- [ ] Per-worker breakdown: regular minutes, OT minutes, holiday minutes, gross cents
- [ ] Per-location + per-job breakdowns
- [ ] Payroll projection widget on admin dashboard

### Payroll export

- [ ] Export action: generates CSV and JSON; uploads to R2 as `PayrollExport` record
- [ ] CSV columns: `worker_name`, `email`, `job_role`, `period_start`, `period_end`, `regular_minutes`, `ot_minutes`, `double_minutes`, `holiday_minutes`, `gross_cents`
- [ ] Caching: never cache payroll responses (`no-store`)

### DoD — Phase 6

- [ ] Vitest suite: classify-minutes covers the full documented edge cases (daily OT only, weekly OT only, both, holiday precedence, mid-period rule change, midnight crossing, DST)
- [ ] CSV export for a realistic test org matches hand-computed values to the cent
- [ ] Mid-period pay-rate change: old entries keep old rate; new entries use new rate

---

## Phase 7 — Invoicing (records only)

- [ ] `Invoice` CRUD (`MANAGER+`): linked to `Client`; lines seeded from a time-period or from a specific `Job`
- [ ] `InvoiceLineItem` editable; auto-populates from `TimeEntry` or `Job` but manager can tweak
- [ ] Invoice number auto-generated (per-org sequence)
- [ ] Status flow: `DRAFT → SENT → MARKED_PAID | DISPUTED | VOID`
- [ ] PDF generation server-side (e.g. React PDF or Puppeteer-on-Vercel); uploaded to R2
- [ ] Signed download URL for the PDF
- [ ] "Send" action can either (a) email the client (Resend) with a signed link or (b) just change status and let the user share externally
- [ ] Mark-paid action with note; `disputeNotes` on `DISPUTED` transition
- [ ] All transitions emit `AuditEvent`

### DoD — Phase 7

- [ ] Generate a real PDF for a fully-filled invoice; totals match line items; org branding shows
- [ ] Dispute flow: disputed invoice visible on admin "Needs action" card
- [ ] Explicit test: no payment-processing code exists anywhere (grep for `paymentIntent`, `charge`, `ach` should be empty)

---

## Phase 8 — Hardening & scale

- [ ] Tune rate limits based on real traffic patterns (auth, invite, clock-in, upload)
- [ ] Background jobs platform chosen (Inngest / QStash / Vercel Cron) and documented
- [ ] Digest emails (weekly summary to admins; daily to managers during active pay period)
- [ ] Audit export UI with filters (date, actor, resource type)
- [ ] Security review pass: IDOR sweep across every resource, upload abuse tests, invite token reuse, session hijack simulation
- [ ] **Stripe plan tiers — expand from MVP's single Growth plan to Starter / Growth / Scale** (webhook plumbing + price mapping infrastructure already shipped in Phase 0):
  - [ ] Populate `PLAN_LIMITS` for `STARTER` real caps (replace the MVP scaffold caps) and add `SCALE` per [`docs/veracrew.md` §9.1](./veracrew.md#91-proposed-post-mvp-tier-structure); reconfirm `GROWTH` caps
  - [ ] Flip `requireFeature` and `requireWithinLimit` from no-ops to real enforcers; add audit-event emission on `PlanLimitError`
  - [ ] Add Starter + Scale Stripe price IDs to `PRICE_ID_TO_PLAN_KEY` (test + live); existing webhook handlers pick them up automatically
  - [ ] Upgrade / downgrade UX: plan selector page, Stripe-hosted checkout for upgrades, `subscription.update` action for same-customer tier changes
  - [ ] Downgrade guard: server-side check blocks downgrade if current usage exceeds target plan's caps; client mirrors the check for UX
  - [ ] Admin billing dashboard expansion: usage bars (workers, locations, invoices, starter packs) vs current plan's caps; "considering upgrade?" CTA when usage > 80% of a cap
  - [ ] Proration behavior documented in the runbook (upgrade mid-period = immediate proration; downgrade = end of period)
  - [ ] 90-day export-only grace cron for `CANCELLED` orgs (nightly scan + audit events on data archival)
  - [ ] Playwright E2E: Starter org tries to add 6th worker → sees upgrade CTA → upgrades via checkout → webhook updates `planKey` → action succeeds
  - [ ] Playwright E2E: Growth org with 4 locations tries to downgrade to Starter → blocked with clear message
  - [ ] Playwright E2E: full signup → 14-day trial → add card (Pattern B) → day 14 auto-charge → upgrade to Scale → downgrade → cancel → reactivate (exercises every transition from `OrgStatus` in one test)
- [ ] **TimeOff-aware conflict detection** — unpack the Phase 4 stub:
  - [ ] Time-off request + approval UI (worker submits; `MANAGER+` approves / declines; notifications on decision)
  - [ ] Approval action re-runs `detectWorkerConflicts` for existing `JobAssignment` rows in the approved window and surfaces clashes to the approver
  - [ ] Flip `RUNTIME_FLAGS.conflictCheckIncludesTimeOff` to `true`
  - [ ] Extend Phase 4 adversarial overlap test suite with a `TIME_OFF` source scenario
- [ ] Per-org monthly upload quota (prevent cost spike from a single abusive org)
- [ ] **Virus scanning — only if triggers met**: first compliance-gated customer or first real incident. Path: R2 Event Notification → Queue → Worker → ClamAV VM → `UserDocument.scanStatus` update + quarantine bucket. See `architecture.md` §16 for sketch.
- [ ] Operational runbook: env vars, migrations, backup/restore, incident response, 2FA reset procedure
- [ ] Observability: error tracking (Sentry), structured logs with org/user IDs but no PII, DB query performance monitoring
- [ ] **Data lifecycle — soft-delete purge cron** (`src/jobs/purgeSoftDeleted.ts`, daily): tombstones `User` rows soft-deleted >30d ago; hard-deletes `Invoice` / `TimeEntry` rows soft-deleted >90d ago AND whose `legalHoldUntil` is null-or-past (enqueues `R2DeletionJob` for any attached files); surfaces `Organization` rows soft-deleted >30d ago to the SUPERUSER console for review (does NOT auto-cascade orgs) — see `architecture.md` §6.11.2
- [ ] **R2 reconciler cron** (`src/jobs/r2Reconciler.ts`, weekly): lists R2 keys per org prefix, left-joins against DB, enqueues `R2DeletionJob` for orphan keys older than 7 days with `reason = "reconciler orphan"`, emits `R2_ORPHAN_QUARANTINED` audit event — see `architecture.md` §6.11.3
- [ ] **SUPERUSER console** (routes outside `(dashboard)`, IP-allowlisted + 2FA required): list / set / clear `Organization.legalHoldUntil`; view DLQ (`R2DeletionJob.dlqAt IS NOT NULL`) with manual retry + mark-complete actions; force-cascade hard-delete an Organization after a mandatory export step; every action emits an audit event (`ORG_LEGAL_HOLD_SET` etc.) to the affected org
- [ ] **SAR / audit export UI** builds on the existing audit export (moved up from Phase 8 line above) with a "filter by actor → include tombstoned users" toggle; tombstone rows render as `former-worker-<last4>` — see `architecture.md` §6.11.4

---

## Cross-cutting — track across all phases

- [ ] Zod schemas centralized; shared types in `.utils/types/index.ts` (per user rules)
- [ ] Error boundaries on every dashboard route group
- [ ] Consistent empty states + loading states
- [ ] Every new model: does it need RLS? (99% yes). Is it in the tenant-scoped list? Does it emit audit events?
- [ ] Every new server action: `requireOrgContext → requireOrgActive (if mutating) → requireRole → zod.parse → scopedPrisma`
- [ ] Every new table: composite indexes designed up-front; money as `Int` cents
- [ ] No `any` in code; no `Float` on financial fields; no raw `prisma.*` bypassing `scopedPrisma` in tenant-scoped queries
- [ ] README kept current: how to set up DB, run migrations, seed, sign in locally
- [ ] i18n: every new UI string goes into both EN and FR message files (French can be a stub initially; no hardcoded English in components)
- [ ] Every new time-bearing model (future candidates: on-call rotations, blackout windows, maintenance windows) plugs into `detectWorkerConflicts` via a new `ConflictSource` value — never a parallel checker that only some callers remember to run

---

## Definition of done for MVP launch

This is the gate to announce general availability. All of:

- [ ] Phase 0 through Phase 7 DoDs pass
- [ ] An adversarial multi-tenant test script runs clean: second test org cannot read/write first org's rows via the API, RLS denial logged for each attempt
- [ ] Full MVP journey passes as Playwright end-to-end:
  1. Owner signup → 2FA → onboarding with starter pack → invite 2 workers
  2. Worker accepts invite → installs PWA → sees schedule
  3. Manager creates a job with required docs → worker submits docs → manager approves → worker clocks in (gate passes)
  4. Worker clocks out → manager exports payroll CSV → totals match expected
  5. Admin generates an invoice → PDF produced → marks sent → audit trail shows every step
- [ ] Works in both EN and FR; locale switch persists across reloads
- [ ] Offline clock-in + sync works on a real phone
- [ ] Security headers pass external scanner (A+)
- [ ] 2FA enforced for OWNER/ADMIN in prod
- [ ] Stripe trial-to-paid flow works end-to-end: new org → 14-day trial → Pattern B add card → day-14 auto-charge → `Organization.status = ACTIVE`. Reactivation from `TRIAL_EXPIRED` also validated.
- [ ] `requireOrgActive` verified in prod: `TRIAL_EXPIRED` org can still sign in, read, export, and clock out open entries; cannot create new writes
- [ ] Rate limits validated on all listed endpoints
- [ ] Runbook exists for DB restore, 2FA reset, and `SUPERUSER` manual org reactivation
