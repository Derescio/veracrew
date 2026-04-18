# Phase 0 — Environment & Provisioning

## Goal

Every external service is provisioned, every environment variable is set, and the app boots (`pnpm dev`) with a live database connection and all secrets validated at startup. No feature code exists yet — this is purely infrastructure readiness. Nothing in Phase 1 can start until this passes.

## Prerequisites

- Veracrew repo cloned; `pnpm install` runs clean.
- You have accounts for: Neon, Cloudflare (R2 + Turnstile), Upstash, Resend, Stripe, Vercel.

---

## Spec

### 1. Database — Neon PostgreSQL

Provision a Neon project with **two branches**:

| Branch | Purpose | Variable |
|---|---|---|
| `main` | Production | `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` |
| `dev` | Local development & migrations | `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` |

- Always run `prisma migrate dev` against the `dev` branch.
- Always run `prisma migrate deploy` in CI against the target branch.
- Use the **pooled** URL for all runtime Prisma queries (PgBouncer transaction mode).
- Use the **unpooled** URL only for migrations (`prisma migrate deploy`) — pooled connections cannot run DDL statements.

### 2. Object Storage — Cloudflare R2

Create **two R2 buckets** per environment:

| Bucket name | Contents |
|---|---|
| `veracrew-docs-dev` | PDFs, uploaded documents (dev) |
| `veracrew-images-dev` | Photos, activity images (dev) |
| `veracrew-docs-prod` | PDFs, uploaded documents (prod) |
| `veracrew-images-prod` | Photos, activity images (prod) |

CORS configuration (apply to both buckets):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-vercel-domain.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Create one **R2 API token** with `Object Read & Write` permission scoped to both buckets. Store `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_ACCOUNT_ID`.

### 3. Bot Protection — Cloudflare Turnstile

Create **two Turnstile sites** (dev and prod). Each gives you a `SITE_KEY` (public, goes in the browser) and a `SECRET_KEY` (private, server-side verification).

Used on: signup form, invite-accept page, public contact/inquiry forms.

### 4. Rate Limiting — Upstash Redis

Create one Upstash Redis database. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Used for: failed auth counters, invite-send throttle, clock-in rate limit, presigned URL generation rate limit.

### 5. Email — Resend

- Create a Resend account and add your sender domain.
- Verify the domain via DNS (SPF + DKIM records).
- Copy `RESEND_API_KEY`.
- Set `EMAIL_FROM` to a verified sender address, e.g. `noreply@yourdomain.com`.

### 6. Billing — Stripe

- Create a Stripe account. You need **both** test mode and live mode keys.
- In test mode, create a product "Veracrew Growth" with a recurring monthly price. Copy the price ID as `STRIPE_PRICE_ID_GROWTH`.
- Register a webhook endpoint pointing at `https://your-domain/api/webhooks/stripe`. Subscribe to:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.trial_will_end`
  - `invoice.finalization_failed`
- Copy the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.

### 7. Hosting — Vercel

- Create a Vercel project linked to the repo.
- Set all env vars in the Vercel dashboard under the correct environments (Preview → dev branch, Production → main).
- Enable **Vercel Cron** (required for billing crons in Phase 3).

### 8. Env-var validation at startup

Create `src/lib/env.ts` using Zod. The app must **throw at boot** if any required variable is missing or malformed — not at the first request that needs it.

```ts
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),

  // Auth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_ID_GROWTH: z.string().startsWith("price_"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_DOCS: z.string().min(1),
  R2_BUCKET_IMAGES: z.string().min(1),
  R2_PUBLIC_URL: z.string().url().optional(), // only if bucket has public access

  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().email(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
```

Import `env` from this file in `src/lib/db/prisma.ts` (the Prisma singleton) so it is evaluated at module load time and fails fast.

### 9. `.env.example`

Check in `.env.example` at the repo root with every variable name and a placeholder comment. Never commit real secrets.

```dotenv
# ─── Database (Neon) ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host/db?sslmode=require&pgbouncer=true
DATABASE_URL_UNPOOLED=postgresql://user:password@host/db?sslmode=require

# ─── Auth ────────────────────────────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
# Generate: openssl rand -base64 32
NEXTAUTH_SECRET=your-32-char-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ─── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_GROWTH=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ─── Cloudflare R2 ───────────────────────────────────────────────────────────
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_DOCS=veracrew-docs-dev
R2_BUCKET_IMAGES=veracrew-images-dev
# R2_PUBLIC_URL=https://pub-xxx.r2.dev  # only if bucket is public

# ─── Cloudflare Turnstile ────────────────────────────────────────────────────
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key

# ─── Upstash Redis ───────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# ─── Resend ──────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# ─── App ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## Tests required

- [ ] `src/lib/env.ts` — unit test: missing a required variable throws a `ZodError` at parse time (use `envSchema.safeParse` with a partial object).
- [ ] DB connectivity smoke test: `prisma.$queryRaw\`SELECT 1\`` returns without error (run as a Vitest setup check, skip in CI if `DATABASE_URL` is not set).

---

## Definition of Done

- [ ] All services provisioned (Neon, R2, Turnstile, Upstash, Resend, Stripe)
- [ ] `.env.example` committed with every variable name
- [ ] `.env.local` in `.gitignore` (never committed)
- [ ] `src/lib/env.ts` parses and validates all env vars at module load
- [ ] `pnpm dev` starts without errors
- [ ] `prisma db pull` (or `prisma migrate dev --create-only`) connects to Neon `dev` branch successfully
- [ ] Vercel project exists; env vars set per environment
