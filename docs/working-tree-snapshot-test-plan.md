# Working-Tree Snapshot — Test Plan

**Purpose:** The working tree contains a large batch of uncommitted work. Most of it was produced by a prior agent that began hallucinating; a smaller, well-scoped set of fixes was produced by a follow-up agent to unblock the app. This document is the source of truth for what needs testing and in what priority order.

**Use this with another agent** by pointing it at this file and asking it to execute the checklists in order. Mark ✅ / ❌ beside each item as you go and capture failures verbatim at the bottom.

---

## 0. Repo state expected when you start

Run these first so the agent understands the baseline:

```powershell
git log --oneline -5
git status --short
pnpm prisma migrate status
```

Expected:

- HEAD is `330f012` "Merge pull request #7 from Derescio/feature/phase-0-r2-email-security-i18n-app-shell-pwa" (phase-0-04 merged).
- Working tree has a large set of modifications and untracked files (see §3).
- `prisma migrate status` prints **"Database schema is up to date"** with 4 migrations (including `20260419233254_add_user_email_verified`).

If any of the above is not true, stop and flag it.

---

## 1. Confirmed fixes from the follow-up agent (high confidence)

These changes were made narrowly to unblock the app. Each one was verified manually at the time. Re-test them end-to-end — if any regress, the rest of the session is suspect.

### 1.1 Route group rename: `(auth)` → `auth`

- **Why:** `src/app/[locale]/(auth)/…` was a route group, which does not emit a URL segment. Every other piece of code (proxy, NextAuth `pages.signIn`, dashboard layout redirects, email templates, cross-links) expects `/auth/…` in the URL.
- **Change:** `git mv src/app/[locale]/(auth) src/app/[locale]/auth`.
- **Test:**

```
GET /en/auth/sign-in         → 200
GET /en/auth/sign-up         → 200
GET /en/auth/forgot-password → 200
```

All three should render without 404.

### 1.2 Google OAuth `AdapterError` fixed

- **Symptom before:** Signing in with Google redirected to `/api/auth/error?error=Configuration` with server log `PrismaClientValidationError: Unknown argument 'emailVerified'`.
- **Root cause:** `@auth/prisma-adapter` requires `User.emailVerified: DateTime?` on the schema; it was missing.
- **Change:** Added `emailVerified DateTime?` to the `User` model and committed a Prisma migration `20260419233254_add_user_email_verified`.
- **Test:**
  1. Open an incognito window (stale JWT cookies from before the `NEXTAUTH_SECRET` change will cause false positives).
  2. Go to `/en/auth/sign-in` and click "Continue with Google".
  3. Complete Google OAuth.
  4. Expect a redirect to `/en` (landing page) with a signed-in session. No `/api/auth/error` page, no 500s in the server log.
- **DB sanity:** `SELECT "emailVerified" FROM "User" LIMIT 1;` should succeed.

### 1.3 Prisma migration ordering fix

- **Before:** `20260419000000_user_active_email_index` had a timestamp that sorted **before** `_init`, so `prisma migrate dev` failed when replaying into the shadow database (`P3006 / P1014: table User does not exist`).
- **Change:**
  - `git mv prisma/migrations/20260419000000_… 20260419025800_…`
  - Updated the matching `_prisma_migrations` row's `migration_name` column so the live DB still maps cleanly.
- **Test:** `pnpm prisma migrate dev --name __probe_do_not_keep` should succeed (then delete the resulting empty migration). Or simply: `pnpm prisma migrate status` must print "up to date" with no drift warning.

### 1.4 Landing page is public and lives at `/[locale]`

- **Before:** `src/app/[locale]/page.tsx` was `redirect('/[locale]/dashboard')`, and the dashboard layout bounced unauth'd users to `/auth/sign-in`. Visiting `/` was therefore an unavoidable redirect to sign-in.
- **Change:**
  - `src/app/[locale]/page.tsx` now renders the landing page (Navbar, Hero, Features, Showcase, Trust, HowItWorks, Pricing, Cta, Footer) and passes a server-computed `user` object to the Navbar.
  - `src/app/page.tsx` is now a thin safety-net `redirect('/en')`.
  - `src/proxy.ts` added a `PUBLIC_PATHS` allowlist (`/`, `/demo`, `/contact`, `/privacy`, `/terms`) and a `stripLocale` helper so auth-gated redirect logic doesn't fire on these paths.
- **Test (signed out):**
  - `GET /` → 307 → `/en` → 200 landing page.
  - `GET /en` → 200 landing page.
  - Navbar top bar: "Log in" link → `/en/auth/sign-in`.
  - Navbar main CTA: "Get Started" → `/en/auth/sign-up`.

### 1.5 Post-signin redirect target

- **Before:** After signing in, the user was pushed to `/${locale}/dashboard`, which would throw `NoActiveOrgError` and redirect to `/${locale}/create-org`.
- **Change:** `src/app/[locale]/auth/sign-in/page.tsx` pushes to `/${locale}` (Credentials) and uses `callbackUrl: /${locale}` (Google).
- **Test:**
  1. Sign in with a user **without an organization** (e.g. a freshly created Google user).
  2. Expect to land on `/en` (landing page), **not** `/en/create-org`.
  3. Navbar top bar should show user email + "Sign out".
  4. Navbar main CTA should say **"Create Organization"** with a `+` icon → `/en/create-org`.
- **Test (user with an org):** main CTA should say **"Go to Dashboard"** → `/en/dashboard`.
- **Test (Sign out):** top-bar Sign out redirects to `/en` as signed-out.

### 1.6 Landing-page hrefs point to real routes

- `HeroSection.tsx`, `CtaSection.tsx`, `PricingSection.tsx` (×2), `Navbar.tsx`: `/auth/register` and `/auth/login` were dead links. All now point to `/en/auth/sign-up` or `/en/auth/sign-in`.
- **Test:** click every CTA button on the landing page while signed out; every one must land on an existing page (no 404).

---

## 2. Previous-agent working-tree changes — HIGH SCRUTINY

Everything in this section was already modified/added in the working tree when the follow-up agent began. The follow-up agent did not verify any of it. Treat as **unverified and possibly hallucinated** until each item is confirmed by running the app or reading the code.

### 2.1 Modified files (pre-existing uncommitted edits)

Test priority for each: read the diff against HEAD (`git diff HEAD -- <path>`), then exercise the feature if applicable.

- **Config / infra**
  - `next.config.ts` — next-intl plugin wired, PWA config, security headers, Turbopack alias. Test: server boots, CSP allows Google sign-in + Turnstile iframe, PWA disabled in dev.
  - `package.json`, `pnpm-lock.yaml` — new deps. Test: `pnpm install` clean; `pnpm build` passes.
  - `prisma/schema.prisma` — most of this schema is from merged phase-0-01; verify any lines not accounted for by prior merges.
  - `prisma/migrations/migration_lock.toml` — check provider string.

- **Auth layer**
  - `src/lib/auth/auth.ts` — NextAuth v5 config, Google + Credentials providers, JWT session, custom callbacks (signIn tombstone guard, jwt/session with org resolution).
  - `src/lib/auth/org-status.ts`, `src/lib/auth/tombstone.ts` — re-read; these are sensitive code paths.
  - `src/types/next-auth.d.ts` — session typing.

- **Tenancy / data**
  - `src/lib/db/scoped-prisma.ts` — org-scoped Prisma wrapper. Verify org scoping is strictly enforced.
  - `src/lib/errors.ts` — error classes used by `requireOrgContext` / dashboard layout redirects.

- **Billing**
  - `src/lib/billing/plan-limits.ts`, `src/lib/billing/webhook-handlers.ts` — Stripe webhook handling.
  - `src/app/api/webhooks/stripe/route.ts`, `src/app/api/crons/billing/route.ts`, `src/jobs/billing-crons.ts`.

- **Infra / shared libs**
  - `src/lib/crypto.ts`, `src/lib/env.ts`, `src/lib/rate-limit.ts`, `src/lib/turnstile.ts`, `src/lib/email/resend.ts`.

- **Actions**
  - `src/actions/storage/download.ts`, `src/actions/storage/upload.ts` — S3/R2 presigned URL helpers.

- **App shell**
  - `src/app/layout.tsx` — root layout.
  - `src/app/[locale]/layout.tsx` — NextIntlClientProvider, TooltipProvider, Toaster.
  - `src/app/[locale]/(dashboard)/layout.tsx` — dashboard shell with BillingBanner + sidebar.
  - `src/app/[locale]/(dashboard)/dashboard/page.tsx` — dashboard home.

- **Landing page copy / links (other than the hrefs the follow-up agent fixed)**
  - `src/components/landingpage/CtaSection.tsx`, `HeroSection.tsx`, `PricingSection.tsx` — only the `href` values were touched this session; the rest is pre-existing.

- **i18n**
  - `src/messages/en.json`, `src/messages/fr.json` — verify keys referenced by the UI exist in both files.

- **Cursor agent config (low risk, not runtime)**
  - `.cursor/agents/code-scanner.md`
  - `.cursor/commands/feature-finish.md`, `feature-load.md`, `feature.md`, `git-workflow.md`, `pr.md`
  - `context/current-feature.md`

- **Deleted stubs under `(dashboard)/_components/`** — `Header.tsx`, `OrgSwitcherStub.tsx`, `Sidebar.tsx`, `SidebarNavItem.tsx`, `UserMenuStub.tsx`. Replaced by `AppHeader.tsx`, `AppSidebar.tsx`, `BillingBanner.tsx` (see §2.2). Verify no orphan imports.

### 2.2 Untracked files (pre-existing additions never committed)

All of these are **brand-new** to the repo. Each one needs a code review before you rely on it.

**Database migration (this session's addition, keep this one):**
- `prisma/migrations/20260419233254_add_user_email_verified/` — ✅ verified in §1.2.

**Server actions (unverified):**
- `src/actions/auth/` — register, accept-invite, two-factor-setup, reset-password, etc. Confirm: rate limiting, Turnstile verification, Zod validation, tombstone handling on sign-up.
- `src/actions/billing/checkout.ts` — Stripe checkout session creation. Confirm: org scoping, role gate (`requireRole('OWNER')` or similar).
- `src/actions/documents/seed-starter-pack.ts` — uses `requireOrgContext` + `requireRole` + `requireOrgActive`.
- `src/actions/locations/create-location.ts` — same guards.
- `src/actions/org/create-org.ts`, `src/actions/org/job-roles.ts`.
- `src/actions/team/invite.ts`, `src/actions/team/members.ts`.
- ❗ Test every action with (a) no session, (b) session but wrong org, (c) session with insufficient role, (d) happy path.

**Dashboard UI (unverified):**
- `src/app/[locale]/(dashboard)/_components/AppHeader.tsx`, `AppSidebar.tsx`, `BillingBanner.tsx`.
- `src/app/[locale]/(dashboard)/dashboard/_components/AlertsPanel.tsx`, `CrewStatusTable.tsx`, `QuickActions.tsx`, `StatCard.tsx`.
- `src/app/[locale]/(dashboard)/settings/` — page, `billing/page.tsx` + `BillingActions.tsx`, `job-roles/page.tsx` + `JobRolesClient.tsx`.
- `src/app/[locale]/(dashboard)/team/page.tsx` + `InviteDialog.tsx`, `PendingInvitesTable.tsx`, `TeamTable.tsx`.

**Onboarding (unverified):**
- `src/app/[locale]/(onboarding)/create-org/page.tsx`.
- `src/app/[locale]/(onboarding)/onboarding/page.tsx` + `StepInviteTeam.tsx`, `StepLocation.tsx`, `StepStarterPack.tsx`.

**Auth pages — these are under `src/app/[locale]/auth/…` because the follow-up agent renamed the route group. Their content is the previous agent's; the containing folder is the only thing that changed.**
- `src/app/[locale]/auth/2fa/setup/page.tsx`
- `src/app/[locale]/auth/forgot-password/page.tsx`
- `src/app/[locale]/auth/invite/[token]/page.tsx` + `_components/InviteAcceptForm.tsx`
- `src/app/[locale]/auth/reset-password/[token]/page.tsx`
- `src/app/[locale]/auth/sign-in/page.tsx` — ⚠ also contains the follow-up agent's 2-line edit (push/callbackUrl target)
- `src/app/[locale]/auth/sign-up/page.tsx`

**shadcn/ui primitives (low runtime risk but bulky):**
- `src/components/ui/` — run a quick scan for any component with custom logic beyond the vanilla shadcn scaffold.

**Hooks:**
- `src/hooks/` — audit each hook for SSR safety, dependency arrays.

**Email templates:**
- `src/lib/email/templates/invite.ts`.

**Docs / assets (no runtime impact):**
- `docs/pahse_0_audit_fix_report.md` (typo in filename).
- `context/screenshots/Admin_Idea.png`, `Dashboard_idea*.png`, `Job_Description_idea.png`, `Jod_desc_1 (*)`.

---

## 3. End-to-end flows to walk through

Run each flow in order, fresh incognito window. Record each step.

### 3.1 Brand-new visitor → signs up → creates org → dashboard

1. `GET /` → landing page renders, Navbar shows "Log in" + "Get Started".
2. Click **Get Started** → `/en/auth/sign-up` renders.
3. Fill the form + Turnstile → submit. Expect either:
   - Redirect to `/en/auth/2fa/setup` if 2FA is required, or
   - Redirect to `/en/create-org`.
4. If 2FA: complete setup, proceed.
5. At `/en/create-org`: fill org details, submit.
6. Expect redirect to `/en/onboarding` or `/en/dashboard`.
7. Dashboard layout: BillingBanner visible if `TRIALING`, sidebar populated, user name/email correct.

### 3.2 Returning user **with no org** signs in

1. `GET /en/auth/sign-in`.
2. Sign in with Credentials or Google.
3. **Expected:** land on `/en` (landing page).
4. Navbar: user email + "Sign out" in top bar; main CTA is **"Create Organization"**.
5. Click **Create Organization** → `/en/create-org`.

### 3.3 Returning user **with active org** signs in

1. Sign in.
2. Land on `/en`.
3. Navbar main CTA reads **"Go to Dashboard"** → `/en/dashboard`.
4. Dashboard loads without redirect loops.

### 3.4 Sign out

1. From any page, click top-bar **Sign out**.
2. Redirected to `/en` as signed-out; CTAs revert to "Log in" / "Get Started".

### 3.5 Email flows (require outgoing email configured)

1. Forgot password → reset email contains link `…/en/auth/reset-password/{token}`.
2. Invite a user → invite email link `…/en/auth/invite/{token}`.
3. Both token landing pages should render and accept the happy path.

### 3.6 Billing (Stripe test mode)

1. As an OWNER of a trialing org, open `/en/settings/billing`.
2. Start checkout → completes via Stripe test card → webhook updates `OrgSubscription.status` to `ACTIVE`.
3. `BillingBanner` should disappear once `status === ACTIVE` and `hasPaymentMethod === true`.

### 3.7 Multi-tenant isolation spot checks

For each server action in `src/actions/**`:
- Sign in as User A (org A), perform the action on a record from org B by forging an ID.
- Expect `ForbiddenError` / `NoActiveOrgError`, **never** a data leak or 500.

---

## 4. Known gotchas the follow-up agent observed

- **Stale JWT cookies.** After any `NEXTAUTH_SECRET` change, old sessions will crash with `JWTSessionError: no matching decryption secret` until the cookie is cleared. Always test with a fresh incognito window.
- **Cloudflare Turnstile console spam.** `[browser] [Cloudflare Turnstile] Error: 110200.` shows up repeatedly in dev. This is the sitekey-vs-hostname mismatch that Turnstile logs in localhost dev; it does not block forms as long as you get a token.
- **`UnauthorizedError` in server log when visiting `/en/dashboard` signed out.** Expected — the dashboard layout throws and the guard redirects. Not a bug.
- **Next-intl "config file not found" was intermittent** during early dev-server restarts; did not reproduce after `next.config.ts` stabilized. Flag if it comes back.
- **`src/lib/auth/auth.ts` line 21:** `pages.signIn: "/auth/sign-in"` has no locale prefix. NextAuth adds it via the proxy + intl middleware. Confirm the proxy's intl step still prepends the correct locale when redirecting via NextAuth's default flow.

---

## 5. Commands cheat-sheet

```powershell
# Boot
pnpm install
pnpm prisma generate
pnpm prisma migrate status

# Dev
pnpm run dev

# Tests (if any still compile)
pnpm test

# Build check
pnpm build
```

---

## 6. Reporting template

For each failure, include:

- Flow / section id (e.g. "§3.2 step 4")
- Exact URL
- Server log excerpt (`terminals/<id>.txt` lines)
- Browser console excerpt
- A one-sentence hypothesis of root cause

Keep the report brief — the goal is to separate **real regressions** from **prior-agent hallucinations** quickly.
