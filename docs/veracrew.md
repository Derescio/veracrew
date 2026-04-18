# Veracrew — Product Brief

Veracrew is a workforce-operations platform for **small and medium businesses with field workers**. It puts the whole crew under one umbrella: people, schedules, compliance, locations, time, jobs, and payroll-ready data — built mobile-first because the people using it are on jobsites, not at desks.

> **Scope of this document**: product vision, personas, features, dashboards, user journeys, MVP boundary. For technical detail (stack, schema, security model, file layout), see [`docs/architecture.md`](./architecture.md). For build sequence, see [`docs/implementation_checklist.md`](./implementation_checklist.md).

---

## 1. Positioning

**For** small-to-medium businesses with field workers — construction crews, cleaning services, property maintenance, facilities teams, trades contractors.

**Veracrew** is a single app where:
- Owners and admins run the business (team, compliance, jobs, invoicing, reporting)
- Managers run the day — schedule, dispatch, approve time, chase documents
- Workers get the job done — see the schedule, clock in on-site, report issues, stay compliant

**Unlike** generic team apps or single-feature tools (a scheduler, a time-tracker, a doc storage product), Veracrew is opinionated about the **field workforce** use case: geofenced clock-in, job-specific compliance, offline-capable mobile, a comprehensive audit trail, and payroll-ready timesheets.

---

## 2. Personas

### Owner / Admin (the buyer)

- Runs an SMB with 5–150 field workers across 1–20 jobsites
- Signed up because they're tired of juggling spreadsheets, paper timesheets, email threads, and a separate doc-storage tool
- Wants: one source of truth, trustworthy time data for payroll, a clean audit trail for disputes and compliance, simple onboarding
- Pays the subscription. Loses sleep over: payroll errors, missing compliance docs when an inspector shows up, invoice disputes they can't back up with records

### Manager (the power user)

- Runs a site, a region, or a specific crew. May be a working manager (also clocking in) or a dispatcher
- Wants: schedule visibility, real-time "who's on site", ability to approve edits and docs quickly, ability to create jobs with clear instructions and required forms
- Pain: late workers, unsubmitted docs, end-of-day reporting that used to mean 45 minutes of paperwork

### Worker (the daily user)

- On a phone, on-site, often with spotty signal
- Wants: just tell me where I'm working today, let me clock in, let me upload what I need to upload, stop emailing me
- Speaks the language of their crew first — Veracrew launches with English and French; more to follow
- Pain: getting marked absent when they were actually on-site, redoing paperwork, not getting paid for all the hours they worked

---

## 3. Selling points

What makes Veracrew worth paying for — and worth saying "no" to a generic tool:

### Geofenced time tracking that workers can't game

- Clock-in is gated to a radius around the assigned location
- GPS + timestamp + device identity captured at the moment of the tap, not later
- Works offline — event queues and replays when signal returns (server validates captured GPS, not replay GPS)
- Suspicious patterns (clock-drift, impossible travel, failed geofence on replay) flagged for manager review

### Compliance as a gate, not a checkbox

- Define document templates once (org-wide or per trade), assign them to workers or to specific jobs
- Required vs optional, with expiry dates and auto-reminders
- Clock-in can be gated on missing/expired docs — per-org choice of hard block or soft warning
- Industry/country starter packs available at onboarding (e.g. Canadian construction basics)

### Job-specific document attachment

- When a manager creates a job, they attach the required forms directly to the job
- Those forms go out in the assignment email as signed, auditable download links
- Workers see the requirements on the job page; can fill out forms and submit from their phone
- Combines "job instructions" and "compliance paperwork" into a single flow

### Trustworthy timesheets and payroll-ready data

- Immutable time entries after submission; edits require manager approval and leave an audit trail
- Pay rules engine: regular, overtime (daily + weekly thresholds — both configurable), holiday calendar
- Rates per trade (Foreman vs Apprentice vs Electrician), override-able per worker
- Export to CSV/JSON — drop into Gusto, QuickBooks Payroll, ADP, or your accountant's existing process
- Pay-rule changes don't rewrite history — past hours always use the rule that was effective then

### Audit trail as a selling point

- Every sensitive action logged: who did what, when, from where
- Exportable by admin for compliance reviews, disputes, and incident response
- Becomes a sales asset when selling to customers who themselves face audits

### Mobile-first, offline-capable

- Installable Progressive Web App — no app store friction
- Schedule, clock-in, and uploads work with zero signal
- Push notifications for schedule reminders and urgent manager messages

### Invoicing records without payment-processor risk

- Generate invoices from tracked hours and jobs
- PDF export, status tracking (draft → sent → marked paid / disputed / void)
- **Veracrew does not process payments** — money movement happens through the customer's existing flow (QuickBooks, bank, etc.)
- Full audit trail on invoice lifecycle is the selling point

### Built for multi-tenant security from day one

- Every data point lives inside an Organization — no cross-tenant leakage
- Three layers of defense (session context, app-layer scoping, database-level row security)
- 2FA required for owners and admins; Cloudflare Turnstile gating public signups and invites
- Details live in [`docs/architecture.md`](./architecture.md) §4

---

## 4. Core feature surface

Organized by what the user does, not by database table.

### Onboarding

- Email + Google sign-up; 2FA enrollment required before first admin action
- 4-step wizard: create org → add first location → pick/upload document templates (including industry starter packs) → invite teammates
- Empty-state dashboard with "next best action" cards until real data exists

### Team & invites

- Two invite flows:
  - **Invite Worker** — any `MANAGER+` can send
  - **Invite Admin / Manager** — `OWNER` / `ADMIN` only
- Resend-powered email with secure single-use tokens
- Accept flow hydrates the new user's `Membership` with the right role and optional trade assignment
- Team page: search, filter, status, trade (`JobRole`), primary location, document compliance summary
- Role changes and suspensions captured in the audit trail
- The ability to create teams and assign to job sites. This increases flexibility and speed

### Locations & geofence

- Add sites by street address (auto-geocoded to lat/lng) or by coordinates directly
- Per-site radius (default 100m, configurable)
- Per-site timezone (auto-detected, editable)
- Map placeholder in MVP; full map view post-MVP
- Active/inactive toggle without deleting history

### Scheduler

- Hybrid model:
  - **Shifts** — recurring work at a location (e.g. Mon–Fri 6am–3pm at Site A)
  - **Jobs** — one-off project work, with their own time windows and (optionally) their own location
  - **Teams** — reusable named groups a scheduler can drop onto a Job in one click
- Workers see a unified "my day" view
- Clock-in validates against whichever applies
- Time-specific double-booking guard — the system refuses (or warns on) assigning a worker to two overlapping commitments

### Teams

Reusable named groups of workers that a scheduler can assign to a Job or Shift in one click, rather than picking people individually every time.

- Example: "Site A morning crew" is six people; assigning that team to Tuesday's demolition job auto-adds all six as `JobAssignment` rows
- `ADMIN` and `MANAGER` can create and edit teams; `WORKER` cannot
- **Assignment is snapshot-at-click, not a live link.** If you add the Site A crew to Tuesday's job today, and next week a team member is swapped out of the crew, Tuesday's job is *not* silently mutated. Schedulers can explicitly "re-sync team → job" if they want the change propagated
- **Time-specific conflict check runs on every add.** If Jordan is on another job finishing at 12:00, she *can* be put on the 3pm gig — no conflict, adjacent intervals are allowed. If she's scheduled 11am–2pm somewhere else, the app either blocks the assignment or shows a warning depending on your org's setting
- Engineering detail: see [`architecture.md` §6.3.1](./architecture.md#631-teams-and-conflict-detection)

### Time & pay

- Clock in / break / break end / clock out — four taps max
- Geofenced; offline-capable
- Breaks are first-class (nested under the time entry), multiple per day supported
- Pay rules engine:
  - Regular hourly rate per `JobRole`, override-able per worker
  - Daily OT threshold (e.g. >8 hours) AND weekly OT threshold (e.g. >40 hours) — both configurable
  - Holiday calendar with holiday multiplier
- Payroll export: CSV/JSON, period-scoped, downloadable

### Compliance & documents

- Org-wide `DocumentTemplate` library — required/optional, per-trade scoping, expiry windows
- Starter packs at onboarding (e.g. Canadian construction basic, residential cleaning)
- Worker submits files, manager approves/rejects with reason
- Auto-reminders for expiring and expired docs
- Clock-in gating (hard block or soft warning, org-configurable)

### Jobs & field activity

- Jobs belong to a `Client`, optionally a `Project`, optionally a `Location`
- Manager creates → picks required documents (from the library, one-off upload, or starter pack) → assigns workers
- Assignment email includes signed download links for required docs
- On the job, workers can post `JobActivity`: issues (with status), notes, photos

### Notifications & messaging

- In-app bell with unread count; activity feed on the dashboard
- Emailed alerts for urgent items only (invites, expiring docs, shift reminders)
- Web Push for real-time on the PWA
- Messaging:
  - Managers can create 1:1 threads with any worker or group threads with multiple participants
  - Workers can start 1:1 threads to their manager only (resolved automatically or via picker)
  - Workers can post in any thread they're in
  - No org-wide channels in MVP

### Dashboard & reports

- Owner/admin dashboard (see §5)
- Worker dashboard (see §6)
- Reports: hours by worker / by location / by job / by period; payroll projections; compliance scores

### Audit trail

- Every sensitive write logged: who, what, when, from where
- Filterable UI for `ADMIN+`
- Export to CSV/JSON

### Internationalization

- English and French at launch
- Org default locale (set in onboarding) + per-user override (profile setting)
- User-generated content (job notes, messages, custom invoice line items) stays in the author's language — no auto-translation

### Billing (Veracrew revenue)

- Stripe Billing, subscription tied to the organization
- **Every new org starts on a 14-day free trial** with full Growth-equivalent access — see §4.1 below
- MVP ships **one paid plan** (internally `GROWTH`); Starter and Scale tiers arrive post-MVP — see [section 9.1](#91-proposed-post-mvp-tier-structure) below
- Final pricing validated with real customers before tier activation

### 4.1 Trial, lockout, and reactivation

Every new organization starts in a **14-day free trial**, full feature access. No credit card required to sign up; card can be added mid-trial to secure the account.

- **Reminder email**: Stripe sends `customer.subscription.trial_will_end` 3 days before the end; we use that to fire one reminder email ("your trial ends in 3 days"). Reminder is **suppressed** if the admin has already attached a payment method.
- **Pay during trial (default)**: admin clicks "Add payment method" mid-trial → Stripe Checkout captures the card, `trial_end` preserved → **no charge today**, remaining trial days are honoured → Stripe auto-bills on day 14. The UI also exposes a secondary "Pay in full today and skip the trial" link for accounting-driven orgs.
- **Trial ends with no payment method**: the org flips to `TRIAL_EXPIRED`, which is **read-only**, not locked. Reads, exports, sign-in, and closing an already-open clock-in all still work; *new* writes (creating a job, adding a schedule, clocking in fresh, generating an invoice) throw `OrgInactiveError` with a billing-page CTA. Workers in the field are never stranded.
- **Reactivation**: the only path is a successful Stripe payment. `invoice.payment_succeeded` webhook flips the org back to `ACTIVE`. A `SUPERUSER`-only manual override exists for support edge cases (Stripe glitches, bank-dispute resolutions); it is audit-logged.
- **Past-due is distinct from trial-expired**: a *paying* customer whose card fails enters Stripe dunning for ~21 days. During this, the org stays fully functional with a red "payment failed — update card" banner for the first 7 days, then drops to `TRIAL_EXPIRED` semantics if Stripe exhausts retries.

Full state machine and webhook handlers: [`architecture.md` §6.7.3](./architecture.md#673-signup-to-billing-flow).

---

## 5. Owner / Admin dashboard

Three bands, top to bottom.

### Live ops (top)

- **Clocked in right now** — count, broken down by location
- **Today's schedule** — who's expected, who's on-site, who's late or no-show
- **Jobsite map** — pins for active locations, dots for workers on-site (post-MVP: real map; MVP: styled list)
- **Open issues reported from the field** — badge count, click through to the issue

### Needs action (middle, card row)

- Pending document approvals
- Expiring-soon and expired compliance documents
- Out-of-radius / flagged clock-in attempts
- Time edits awaiting approval
- Pending worker invites (not yet accepted)
- Unpaid / overdue invoices

### Trends (bottom, charts)

- Hours this week vs last week
- Payroll projection for the current pay period
- Compliance score per location or per crew (% workers with all required docs current)
- Jobs completed this week
- Recent activity feed (last 20 events from the audit trail)

Some bands are gated by role: Managers see the slices relevant to their scope; `ADMIN+` see everything; payroll projection and billing widgets are `ADMIN+` only.

---

## 6. Worker dashboard

Mobile-first; bigger touch targets, less scrolling.

- **Today's block** — assigned location, job (if any), shift times, and a single giant Clock-in button (or Break / Clock-out if mid-shift)
- **My required documents** — what's missing, what's expiring, upload CTA
- **Upcoming schedule** — next 3 days at a glance
- **Messages** — thread with my manager, any group threads
- **Activity** — recent issues/notes I've posted

If there's an active shift, everything above it collapses to make room for the shift state (time elapsed, break controls, location confirmation, upload CTA for a job activity).

---

## 7. User journeys

### A. Owner signs up → first clock-in (fastest path)

1. Owner signs up via Google OAuth → forced into 2FA enrollment
2. 4-step onboarding: org name / country / timezone → first location (address geocoded) → picks "Canadian construction basic" starter pack of doc templates → invites two workers by email
3. Owner themselves is prompted to submit their own required docs (the templates they just selected)
4. Workers click invite email → land on accept page (Turnstile gate) → sign up → auto-placed in org as `WORKER`
5. First worker opens the app on their phone, installs the PWA, clocks in at the site
6. Owner sees the clock-in appear on the live dashboard within seconds

### B. Worker invited → first shift

1. Worker gets invite email (in English or French per inviter's setting, overridable after signup)
2. Clicks link → accept invite → sign up (email + password or Google) → 2FA optional
3. Lands on worker dashboard — sees no assignment yet
4. Manager assigns them to a shift → appears in their "Upcoming schedule"
5. Day of: worker opens the app near the site → taps Clock In → GPS captured, in radius, success
6. Takes a break → comes back → clocks out
7. Timesheet shows worked time, break deducted, OT classified automatically based on the org's pay rule

### C. Manager creates a job with required docs

1. Manager opens Jobs → New Job
2. Picks a client (or creates one inline), location, scheduled window
3. **Required documents section**: adds "Daily hazard assessment" (fill-out) from the template library, adds "Site safety brief.pdf" (one-off upload, reference), requires "WHMIS certification" (pre-existing required)
4. Assigns two workers
5. Sends assignment — workers each get a Resend email with the job details and signed download links for the required docs
6. Workers can't clock in at that job's location until all required docs are satisfied (per the org's clock-in gate policy)
7. Workers fill out the hazard assessment on their phone → submit → manager reviews and approves → gate clears → workers clock in

### D. Mid-day: worker reports an issue

1. Worker is clocked in at the site; notices a damaged piece of equipment
2. Opens the active job → taps "Add Activity" → picks "Issue" → takes a photo → adds a note → submits
3. Manager gets an in-app notification + push; opens the issue from the activity feed
4. Manager assigns the issue a resolution state, comments in the thread, marks resolved when done
5. All of this appears in the audit trail and in the job's activity history

---

## 8. MVP vs post-MVP boundary

### In MVP

- Email + Google auth; 2FA required for `OWNER`/`ADMIN`
- Organization, `Membership`, `JobRole`, two-track invite flow, 4-step onboarding, starter packs
- Locations (geocoded, radius, timezone)
- Recurring shifts + one-off jobs, with job-specific required docs
- Geofenced clock-in with PWA offline queue, breaks, immutable-after-submit
- Pay rule engine (regular, daily OT, weekly OT, holiday); per-trade rates with worker overrides
- Payroll export (CSV/JSON)
- Compliance: templates with expiry, per-trade scoping, starter packs, approval workflow, expiry reminders
- `JobActivity`: issues / notes / images
- Notifications (in-app bell) + email alerts (urgent only) + Web Push
- Messaging: 1:1 and manager-created group threads
- Invoicing: records only (no payment processing), PDF export, status flow
- Dashboard (admin + worker views)
- Audit trail (queryable, exportable)
- Internationalization: EN + FR, org default + user override
- Stripe Billing subscription for Veracrew: 14-day Growth-equivalent free trial on signup, then one paid plan (Pattern B default — card preserves trial); read-only lockout at trial expiry; Stripe-webhook-driven reactivation (§4.1)
- Cloudflare R2 storage, Cloudflare Turnstile

### Not in MVP (post-MVP, no rejection)

- Native mobile app (React Native / Expo)
- Gusto / QuickBooks Payroll / ADP integrations (export-only in MVP)
- Virus scanning on uploads (heuristics + content-disposition in MVP — see `architecture.md` §16 for trigger criteria)
- Tiered Stripe plans, Stripe-managed seat enforcement
- Real mapbox/google map on locations / dashboard
- Client portal (clients viewing their own invoices and job status)
- Tax and deduction rules per country
- HIPAA / SOC 2 / GDPR formal compliance work
- Stripe Connect for customer-facing payments (explicit non-goal)
- Automatic translation of user-generated content (explicit non-goal)
- Worker-initiated org-wide channels (explicit non-goal)
- Per-user notification preference UI (fixed rules in MVP)

---

## 9. Nice-to-have / later

- Shift swap & time-off request flow — when this ships, the conflict detector starts including approved time-off as a commitment source; design is already wired for it (see [`architecture.md` §6.3.2](./architecture.md#632-timeoffrequest-schema-locked-enforcement-deferred))
- Mobile apps (React Native)
- Calendar sync (Google / Outlook) for schedules
- Voice-to-text on activity notes
- Per-country / per-province holiday calendar auto-import
- Customer-branded invoice PDFs
- Automated reminder cascades for unpaid invoices
- SSO (Microsoft, Okta) for larger customers
- AI-assisted document classification (auto-detect when someone uploads a WHMIS cert into "other")
- Worker referral program tracking

---

### 9.1 Proposed post-MVP tier structure

MVP ships **one paid plan that is functionally the Growth tier below** — preceded by a 14-day free trial with the same feature surface (see §4.1). Starter and Scale are post-MVP additions once real usage and pricing signals are in hand. Prices below are placeholder ranges — final numbers validated with actual customers.

#### Guiding rules (non-negotiable)

- **Never gate security features.** 2FA, RLS, audit trail writes, Turnstile, signed URLs, session rotation — included in every tier, including the cheapest.
- **Never gate core compliance.** Document templates, expiry tracking, approval workflow — every tier. Gating compliance on a field-workforce app creates liability.
- **Gate on scale and advanced operational features**, not on core value. Clock-in, base messaging, base scheduling, Web Push notifications — every tier.
- **Generous seat counts at the low end.** Hook small crews; let them grow into higher tiers.

#### Starter — "Get your crew online"

Target: single-site SMBs with 1–5 workers.

- Placeholder price: **~$29–49/month flat** (not per-seat at this tier)
- Up to **5 active workers**, 1 `ADMIN` + 1 `MANAGER` seat (OWNER counts as ADMIN)
- **1 location**
- **1 starter pack** included
- Core features: geofenced clock-in + breaks, basic scheduler (recurring shifts **or** one-off jobs, not both in the same view), compliance docs with expiry + approval, 1:1 worker↔manager messaging, in-app notifications, payroll CSV export, audit trail viewable in UI (no export)
- Invoicing: up to **5 invoices/month**, PDF export
- EN + FR included
- Email support, 48h response

#### Growth — "Run the business"

Target: the sweet spot. Most paying customers will land here.

- Placeholder price: **~$7–12/worker/month**, 6–50 workers
- Up to **50 active workers**, unlimited `ADMIN` + `MANAGER` seats
- Up to **5 locations**
- **Full scheduler** — recurring shifts AND one-off jobs together
- **Job-specific required documents** (attach-to-job flow)
- **All starter packs** available
- Per-`JobRole` rates + per-worker overrides
- **Daily AND weekly OT** rules both active
- Group messaging threads, `JobActivity` uploads (issues, notes, images)
- Web Push notifications
- JSON export in addition to CSV
- Advanced reports (payroll projections, compliance score by location / crew)
- Audit trail exportable to CSV
- Invoicing: **unlimited**, status tracking (mark paid / disputed / void)
- Priority email support, 12h response

#### Scale — "Multi-site operations"

Target: larger SMBs, multi-site, complex payroll, integration-hungry.

- Placeholder price: **custom**, 50+ workers
- **Unlimited** workers, locations, invoices
- **API access** for custom integrations (payroll systems, ERP, CRM)
- **SSO** (Google Workspace, Microsoft Entra)
- **Multi-org admin view** (one person administering multiple `Organization` rows — already supported by the `Membership` model)
- **Custom starter packs** (admin-uploadable, org-specific bundles)
- **Long-term audit retention** with partitioned storage (see `architecture.md` §6.10)
- **Dedicated onboarding** (human-assisted)
- Phone support + SLA
- Future home for: direct Gusto / QuickBooks Payroll integrations, virus scanning, client portal, white-label PDF branding

#### Plumbing

The schema is ready today:

- `OrgSubscription.planKey` stores the tier as a `PlanKey` enum (`STARTER | GROWTH | SCALE`). MVP provisions every org at `GROWTH` via the `PRICE_ID_TO_PLAN_KEY` mapping (`architecture.md` §6.7.4); the Prisma `@default(STARTER)` is a safety floor only
- `OrgSubscription.status` mirrors Stripe verbatim (`trialing`, `active`, `past_due`, `canceled`, `incomplete`, …); `Organization.status` is our own coarse activity state (`TRIALING | ACTIVE | PAST_DUE | TRIAL_EXPIRED | CANCELLED | SUSPENDED`)
- `OrgSubscription.seatCount` tracks paid seats
- `src/lib/billing/plan-limits.ts` declares per-tier caps and feature flags
- `requireFeature(flag, ctx)` and `requireWithinLimit(resource, ctx)` helpers gate actions — both are **no-ops in MVP** (return `true`) and flip to real enforcers in Phase 8
- `requireOrgActive(ctx)` middleware blocks writes when `Organization.status = TRIAL_EXPIRED` or `SUSPENDED` — this one is live from Phase 0, not deferred

Full engineering detail: [`architecture.md` §6.7 + §6.7.1 + §6.7.2 + §6.7.3 + §6.7.4](./architecture.md#67-billing-veracrew-revenue).

---

## 10. Locked technical decisions (plain-language)

Every technical specific lives in [`docs/architecture.md`](./architecture.md). Summary, in words:

- **Roles**: Owner, Admin, Manager, Worker — distinct from trade/pay role ("JobRole": Foreman, Apprentice, etc.)
- **One user, many organizations**: the same email can belong to multiple SMBs (e.g. someone with two side jobs)
- **Storage**: Cloudflare R2 for documents and images — zero egress fees, good fit for a doc-heavy tool
- **Offline**: the app is a Progressive Web App with offline-capable clock-in queuing
- **Money**: every cent tracked as an integer; floats banned in financial calculations (prevents rounding bugs)
- **Pay rules**: versioned — changing rates doesn't rewrite history
- **Invoices**: we record and export them; we don't touch the money
- **Security**: multi-tenant isolation enforced at three independent layers; no one layer can leak another tenant's data on its own
- **Teams**: schedulers can bundle workers into reusable teams; assigning a team to a job materializes individual assignments at click time — later roster changes never silently alter past or future schedules
- **Conflict detection**: overlap checks are half-open (12:00 end + 12:00 start = fine); org-level setting picks whether overlaps block the assignment or just warn
- **Trial-by-default**: every new org gets 14 days of full Growth-equivalent access with no card required; Stripe's native `trial_will_end` event powers the 3-day reminder email
- **Org activity state**: the `Organization.status` lifecycle is `TRIALING → ACTIVE → PAST_DUE → TRIAL_EXPIRED → CANCELLED`, with `SUSPENDED` as a Veracrew-only override. `TRIAL_EXPIRED` is **read-only** (reads + exports + sign-in + clock-out on already-open entries still work); only a successful Stripe payment reactivates — workers in the field are never stranded mid-shift

---

## 11. Definition of done for the MVP launch

A new SMB owner can, in one session, complete end-to-end:

1. Sign up, get through 2FA, complete onboarding with a starter pack, invite two workers
2. Create a location, create a recurring shift, create a one-off job with required docs, assign workers
3. Workers accept invites, install the PWA on their phones, see the schedule
4. Workers submit required docs, manager approves, worker clocks in on-site
5. Worker takes breaks, clocks out; timesheet shows correct regular vs OT split
6. Manager exports the week's payroll CSV
7. Admin generates an invoice from the week's billable hours, exports the PDF
8. Admin views the audit trail, filters by actor, exports a range

All of the above with:
- No cross-tenant data leakage under any adversarial test (see `architecture.md` §4, §17)
- Works offline for the worker on jobsite (clock-in syncs on reconnect)
- Works in both English and French
- Under the subscription payment flow (Stripe)

---

## Cross-references

- Engineering: [`docs/architecture.md`](./architecture.md)
- Tier plumbing (enum + limits + helpers): [`architecture.md` §6.7.1](./architecture.md#671-plan-limits-and-feature-gating)
- Org activity middleware + `OrgInactiveError`: [`architecture.md` §6.7.2](./architecture.md#672-org-activity-middleware)
- Signup-to-billing flow (trial, Pattern B pay, reactivation, cancel behaviour, cron TZ): [`architecture.md` §6.7.3](./architecture.md#673-signup-to-billing-flow)
- Stripe price → PlanKey mapping: [`architecture.md` §6.7.4](./architecture.md#674-stripe-price--plankey-mapping)
- Billing audit + ActivityEvent fan-out: [`architecture.md` §6.9](./architecture.md#69-audit)
- Edge cases + deferred items: [`docs/edge-cases.md`](./edge-cases.md)
- Build sequence: [`docs/implementation_checklist.md`](./implementation_checklist.md)
- Coding standards: [`.cursor/rules/coding-standards.mdc`](../.cursor/rules/coding-standards.mdc)
