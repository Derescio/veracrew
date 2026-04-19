# Phase 0 — R2 File Storage, Email, Security Headers, Turnstile, i18n Shell, App Shell, and PWA Scaffold

## Goal

The app is deployable and hardened: files upload to Cloudflare R2 via presigned URLs, transactional email sends via Resend, security headers protect every response, the i18n shell supports English and French, and the app installs as a PWA on mobile. At the end of this slice, the infrastructure layer is complete and Phase 1 feature work can begin. Check the .env file for confirmation.

## Prerequisites

- Phase 0-00 (setup): R2 buckets provisioned, `R2_*` env vars set, Resend API key configured, `RESEND_API_KEY` set.
- Phase 0-01 (database): `R2DeletionJob` model available in the schema.
- Phase 0-02 (auth): `requireOrgContext()` available for securing upload endpoints.

---

## Spec

### 1. R2 file storage

Install the AWS SDK v3 (R2 is S3-compatible):

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

#### R2 client singleton

Create `src/lib/storage/r2.ts`:

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKETS = {
  docs: env.R2_BUCKET_DOCS,     // "veracrew-docs-dev" / "veracrew-docs-prod"
  images: env.R2_BUCKET_IMAGES, // "veracrew-images-dev" / "veracrew-images-prod"
} as const;

export type BucketKey = keyof typeof BUCKETS;
```

#### Object key convention

Every R2 object key is namespaced by org to allow per-org access management and reconciliation:

```
org_{organizationId}/documents/user_{userId}/{uuid}.pdf
org_{organizationId}/images/job_{jobId}/{uuid}.jpg
org_{organizationId}/templates/{templateId}/{uuid}.pdf
```

Create `src/lib/storage/keys.ts`:

```ts
import { randomUUID } from "crypto";

export function makeDocKey(organizationId: string, userId: string, ext: string): string {
  return `org_${organizationId}/documents/user_${userId}/${randomUUID()}.${ext}`;
}

export function makeImageKey(organizationId: string, jobId: string, ext: string): string {
  return `org_${organizationId}/images/job_${jobId}/${randomUUID()}.${ext}`;
}

export function makeTemplateKey(organizationId: string, templateId: string, ext: string): string {
  return `org_${organizationId}/templates/${templateId}/${randomUUID()}.${ext}`;
}
```

#### Upload flow (presign → browser PUT → finalize)

The flow has three steps:
1. **Presign** (server action): generate a presigned PUT URL and return it to the client.
2. **Browser PUT**: the client uploads directly to R2 using the presigned URL — the file never passes through the Next.js server.
3. **Finalize** (server action): confirm the upload succeeded, create the DB row, and return the object key. On failure, enqueue an `R2DeletionJob` to clean up the orphaned object.

Create `src/actions/storage/upload.ts`:

```ts
"use server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, BUCKETS } from "@/lib/storage/r2";
import { requireOrgContext } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { prisma } from "@/lib/db/prisma";
import { makeDocKey } from "@/lib/storage/keys";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 presigned URL requests per minute per user
});

// Extensions that are never accepted regardless of content-type.
// Executables, scripts, and server-side code that could be served back to users.
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js", "mjs", "ts",
  "ps1", "sh", "bash", "zsh", "php", "py", "rb", "pl", "jsp", "asp",
  "aspx", "htaccess", "htpasswd", "jar", "war", "ear",
]);

// Size caps per file type (bytes)
const MAX_SIZE: Record<string, number> = {
  document: 50 * 1024 * 1024, // 50 MB
  template: 50 * 1024 * 1024, // 50 MB
  image:    25 * 1024 * 1024, // 25 MB
};

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(1),
  fileType: z.enum(["document", "image", "template"]),
  targetId: z.string().min(1), // userId, jobId, or templateId depending on fileType
});

export async function getPresignedUploadUrl(input: z.infer<typeof presignSchema>) {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);

  const { success } = await ratelimit.limit(ctx.userId);
  if (!success) return { error: "Rate limit exceeded. Try again in a minute." };

  const parsed = presignSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { fileName, contentType, sizeBytes, fileType, targetId } = parsed.data;

  // Extension blocklist — checked before allocating any R2 resources
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { error: "File type not allowed." };
  }

  // Per-type size cap
  const maxSize = MAX_SIZE[fileType] ?? MAX_SIZE.document;
  if (sizeBytes > maxSize) {
    return { error: `File exceeds the ${Math.round(maxSize / 1024 / 1024)} MB limit for ${fileType}s.` };
  }

  const bucket = fileType === "image" ? BUCKETS.images : BUCKETS.docs;

  let objectKey: string;
  if (fileType === "document") {
    objectKey = makeDocKey(ctx.organizationId, targetId, ext);
  } else if (fileType === "image") {
    objectKey = makeImageKey(ctx.organizationId, targetId, ext);
  } else {
    objectKey = makeTemplateKey(ctx.organizationId, targetId, ext);
  }

  const presignedUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: 300 } // 5 minutes
  );

  return { data: { presignedUrl, objectKey, bucket } };
}

// Magic-byte signatures for allowed MIME types.
// Any file not matching its declared contentType is rejected.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "application/pdf":  [new Uint8Array([0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/jpeg":       [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png":        [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  "image/webp":       [new Uint8Array([0x52, 0x49, 0x46, 0x46])], // RIFF
  "image/gif":        [new Uint8Array([0x47, 0x49, 0x46, 0x38])], // GIF8
  // docx/xlsx/pptx are ZIP-based — we allow them but do not verify magic bytes beyond PDF/images
};

function matchesMagicBytes(buffer: Uint8Array, contentType: string): boolean {
  const signatures = MAGIC_BYTES[contentType];
  if (!signatures) return true; // no signature defined — allow by default (e.g. docx)
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

/**
 * Called after the browser successfully PUTs the file to R2.
 * Creates the DB record. On failure, enqueues an R2DeletionJob to clean up the orphaned object.
 */
export async function finalizeUpload(input: {
  objectKey: string;
  bucket: string;
  templateId: string;
  contentType: string;
  sizeBytes: number;
  originalFileName: string; // stored for display; NEVER used as the R2 key
}) {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);

  // Verify the object key belongs to this org before doing anything else
  if (!input.objectKey.startsWith(`org_${ctx.organizationId}/`)) {
    return { error: "Access denied." };
  }

  let headResult: Awaited<ReturnType<typeof r2.send>>;
  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    headResult = await r2.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
  } catch {
    return { error: "Upload verification failed. The file was not found in storage." };
  }

  // Confirm the size reported by the client matches what R2 actually stored
  const storedSize = (headResult as { ContentLength?: number }).ContentLength ?? 0;
  if (Math.abs(storedSize - input.sizeBytes) > 1024) {
    // Mismatch — clean up and reject. Tolerance of 1 KB for padding/metadata variance.
    await prisma.r2DeletionJob.create({
      data: { bucket: input.bucket, objectKey: input.objectKey, reason: "size mismatch on finalize", sourceModel: "UserDocument" },
    });
    return { error: "File size mismatch. Upload rejected." };
  }

  // Magic-byte check: stream the first 8 bytes to validate content type
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const obj = await r2.send(new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      Range: "bytes=0-7",
    }));
    const stream = obj.Body as AsyncIterable<Uint8Array>;
    let header = new Uint8Array(0);
    for await (const chunk of stream) {
      header = new Uint8Array([...header, ...chunk]);
      if (header.length >= 8) break;
    }
    if (!matchesMagicBytes(header, input.contentType)) {
      await prisma.r2DeletionJob.create({
        data: { bucket: input.bucket, objectKey: input.objectKey, reason: "magic byte mismatch", sourceModel: "UserDocument" },
      });
      return { error: "File content does not match declared type. Upload rejected." };
    }
  } catch {
    // Treat read failure as a hard rejection
    return { error: "Upload verification failed." };
  }

  try {
    // Create the UserDocument row (example — adapt to the specific resource type)
    const doc = await prisma.userDocument.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        templateId: input.templateId,
        fileUrl: input.objectKey,
        status: "SUBMITTED",
      },
    });
    return { data: doc };
  } catch (err) {
    // Finalize failed — enqueue cleanup so the R2 object doesn't orphan
    await prisma.r2DeletionJob.create({
      data: {
        bucket: input.bucket,
        objectKey: input.objectKey,
        reason: "finalizeUpload rollback",
        sourceModel: "UserDocument",
      },
    });
    return { error: "Failed to save document record." };
  }
}
```

#### Presigned download URL (for secure document access)

Files in R2 are **not publicly accessible**. Every download goes through a server action that generates a time-limited signed URL:

```ts
// src/actions/storage/download.ts
"use server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/storage/r2";
import { requireOrgContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "1 m"),
});

/**
 * @param originalFileName - The human-readable filename used in Content-Disposition.
 *   Must be fetched from the DB row, never from client input.
 */
export async function getPresignedDownloadUrl(
  bucket: string,
  objectKey: string,
  originalFileName: string
) {
  const ctx = await requireOrgContext();

  // Object key prefix check: enforces cross-org access is impossible
  if (!objectKey.startsWith(`org_${ctx.organizationId}/`)) {
    return { error: "Access denied" };
  }

  const { success } = await ratelimit.limit(ctx.userId);
  if (!success) return { error: "Rate limit exceeded." };

  // Sanitize originalFileName for use in the header: strip non-ASCII and quotes
  const safeFileName = originalFileName.replace(/[^\w\s.\-()]/g, "").slice(0, 200) || "download";

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      // Force browser save-as dialog; prevents inline execution of uploaded files
      ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
    }),
    { expiresIn: 3600 } // 1 hour
  );

  // Fire-and-forget audit trail for document downloads (regulatory access log)
  prisma.auditEvent
    .create({
      data: {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "DOC_DOWNLOAD",
        resourceType: "UserDocument",
        resourceId: objectKey, // use objectKey as the identifier until Phase 1 passes the doc id
      },
    })
    .catch((err: unknown) => {
      console.error("[download] AuditEvent emit failed:", err);
    });

  return { data: { url } };
}
```

### 2. Resend email

Install:

```bash
pnpm add resend
```

Create `src/lib/email/resend.ts`:

```ts
import { Resend } from "resend";
import { env } from "@/lib/env";

export const resend = new Resend(env.RESEND_API_KEY);

export const EMAIL_FROM = env.EMAIL_FROM;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
}
```

The billing lifecycle requires four transactional email templates, each in English and French. All templates accept an `appUrl` parameter rather than reading `NEXT_PUBLIC_APP_URL` directly so they are unit-testable in isolation.

Create `src/lib/email/templates/trial-will-end.ts`:

```ts
// Sent 3 days before trial expiry. Triggered by the billing cron.
export interface TrialWillEndParams {
  orgName: string;
  daysRemaining: number;
  appUrl: string;
  locale?: "en" | "fr";
}

export function trialWillEndTemplate({
  orgName, daysRemaining, appUrl, locale = "en",
}: TrialWillEndParams): { subject: string; html: string; text: string } {
  const billingUrl = `${appUrl}/settings/billing`;
  const days = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const joursText = `${daysRemaining} jour${daysRemaining === 1 ? "" : "s"}`;

  if (locale === "fr") {
    return {
      subject: `Votre essai Veracrew se termine dans ${joursText}`,
      html: `<h1>Votre essai se termine bientôt</h1><p>L'essai Veracrew de <strong>${orgName}</strong> se termine dans <strong>${joursText}</strong>.</p><p>Ajoutez un moyen de paiement pour continuer sans interruption.</p><a href="${billingUrl}">Ajouter un moyen de paiement</a>`,
      text: `L'essai Veracrew de ${orgName} se termine dans ${joursText}. Ajoutez un moyen de paiement sur ${billingUrl}`,
    };
  }

  return {
    subject: `Your Veracrew trial ends in ${days}`,
    html: `<h1>Your trial is ending soon</h1><p>Your Veracrew trial for <strong>${orgName}</strong> ends in <strong>${days}</strong>.</p><p>Add a payment method to keep your crew running without interruption.</p><a href="${billingUrl}">Add payment method</a>`,
    text: `Your Veracrew trial for ${orgName} ends in ${days}. Add a payment method at ${billingUrl}`,
  };
}
```

Create `src/lib/email/templates/trial-expired.ts`:

```ts
// Sent when the trial ends without a payment method. Org moves to TRIAL_EXPIRED.
export interface TrialExpiredParams {
  orgName: string;
  appUrl: string;
  locale?: "en" | "fr";
}

export function trialExpiredTemplate({
  orgName, appUrl, locale = "en",
}: TrialExpiredParams): { subject: string; html: string; text: string } {
  const billingUrl = `${appUrl}/settings/billing`;

  if (locale === "fr") {
    return {
      subject: `Votre essai Veracrew a expiré`,
      html: `<h1>Votre essai a expiré</h1><p>L'essai gratuit de <strong>${orgName}</strong> est terminé. L'accès à votre compte est suspendu.</p><p>Abonnez-vous pour réactiver votre compte et récupérer toutes vos données.</p><a href="${billingUrl}">Souscrire maintenant</a>`,
      text: `L'essai de ${orgName} a expiré. Abonnez-vous sur ${billingUrl} pour réactiver votre compte.`,
    };
  }

  return {
    subject: `Your Veracrew trial has expired`,
    html: `<h1>Your trial has expired</h1><p>The free trial for <strong>${orgName}</strong> has ended and access has been suspended.</p><p>Subscribe to reactivate your account and recover all your data.</p><a href="${billingUrl}">Subscribe now</a>`,
    text: `The trial for ${orgName} has expired. Subscribe at ${billingUrl} to reactivate your account.`,
  };
}
```

Create `src/lib/email/templates/welcome-to-paid.ts`:

```ts
// Sent when a trial converts to a paid subscription (invoice.paid on first cycle).
export interface WelcomeToPaidParams {
  orgName: string;
  planName: string;
  appUrl: string;
  locale?: "en" | "fr";
}

export function welcomeToPaidTemplate({
  orgName, planName, appUrl, locale = "en",
}: WelcomeToPaidParams): { subject: string; html: string; text: string } {
  const dashboardUrl = `${appUrl}/dashboard`;

  if (locale === "fr") {
    return {
      subject: `Bienvenue sur Veracrew ${planName} !`,
      html: `<h1>Bienvenue sur le plan ${planName} !</h1><p>Merci, <strong>${orgName}</strong>. Votre abonnement Veracrew ${planName} est maintenant actif.</p><p>Vous bénéficiez d'un accès complet à toutes les fonctionnalités.</p><a href="${dashboardUrl}">Accéder au tableau de bord</a>`,
      text: `Bienvenue sur Veracrew ${planName} ! L'abonnement de ${orgName} est actif. Tableau de bord : ${dashboardUrl}`,
    };
  }

  return {
    subject: `Welcome to Veracrew ${planName}!`,
    html: `<h1>Welcome to the ${planName} plan!</h1><p>Thank you, <strong>${orgName}</strong>. Your Veracrew ${planName} subscription is now active.</p><p>You have full access to all features.</p><a href="${dashboardUrl}">Go to dashboard</a>`,
    text: `Welcome to Veracrew ${planName}! ${orgName}'s subscription is active. Dashboard: ${dashboardUrl}`,
  };
}
```

Create `src/lib/email/templates/payment-failed.ts`:

```ts
// Sent when Stripe fires invoice.payment_failed. Org moves to PAST_DUE.
export interface PaymentFailedParams {
  orgName: string;
  appUrl: string;
  nextRetryDate?: string; // ISO date string, optional
  locale?: "en" | "fr";
}

export function paymentFailedTemplate({
  orgName, appUrl, nextRetryDate, locale = "en",
}: PaymentFailedParams): { subject: string; html: string; text: string } {
  const billingUrl = `${appUrl}/settings/billing`;
  const retryNote = nextRetryDate
    ? ` Stripe will retry on ${new Date(nextRetryDate).toLocaleDateString("en-CA")}.`
    : "";
  const retryNoteFr = nextRetryDate
    ? ` Stripe réessaiera le ${new Date(nextRetryDate).toLocaleDateString("fr-CA")}.`
    : "";

  if (locale === "fr") {
    return {
      subject: `Échec du paiement Veracrew — action requise`,
      html: `<h1>Échec du paiement</h1><p>Le paiement de l'abonnement Veracrew de <strong>${orgName}</strong> a échoué.${retryNoteFr}</p><p>Mettez à jour votre moyen de paiement pour éviter une interruption de service.</p><a href="${billingUrl}">Mettre à jour le paiement</a>`,
      text: `Échec du paiement pour ${orgName}.${retryNoteFr} Mettez à jour votre moyen de paiement sur ${billingUrl}`,
    };
  }

  return {
    subject: `Veracrew payment failed — action required`,
    html: `<h1>Payment failed</h1><p>The payment for <strong>${orgName}</strong>'s Veracrew subscription failed.${retryNote}</p><p>Update your payment method to avoid service interruption.</p><a href="${billingUrl}">Update payment method</a>`,
    text: `Payment failed for ${orgName}.${retryNote} Update your payment method at ${billingUrl}`,
  };
}
```

**Usage in billing crons:** import the template function, resolve the org's `defaultLocale`, then call `sendEmail` with the rendered `subject` and `html`. Never hard-code locale; always read from `Organization.defaultLocale`.

**Note on bounce handling:** Configure Resend webhooks for `email.bounced` and `email.complained` events. Wire them to suppress future sends to the bounced address. This is Phase 1 work — log a console warning for now.

### 3. Rate limiting with Upstash

Install:

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

Create `src/lib/rate-limit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Named rate limiters. Add new ones here as needed.
export const rateLimits = {
  // Auth endpoints
  signIn:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m") }),
  signUp:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "5 m") }),

  // Invites
  inviteSend:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h") }),

  // Clock-in (per org, not per user — prevent replay attacks)
  clockIn:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") }),

  // R2 presigned URL generation (per user)
  uploadUrl:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") }),
  downloadUrl: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m") }),
};

export async function checkRateLimit(
  limiter: Ratelimit,
  key: string
): Promise<{ limited: boolean; remaining: number }> {
  const result = await limiter.limit(key);
  return { limited: !result.success, remaining: result.remaining };
}
```

### 4. Cloudflare Turnstile (bot protection)

Turnstile is used on all public-facing forms: signup, sign-in, invite-accept, and any future contact/reset forms. It is not used on authenticated routes.

Install:

```bash
pnpm add @marsidev/react-turnstile
```

#### Environment variables (already in `phase-0-00-setup.md`)

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=  # from Cloudflare dashboard
TURNSTILE_SECRET_KEY=            # server-side only; NEVER expose to client
```

#### Client widget component

Create `src/components/auth/TurnstileWidget.tsx`:

```tsx
"use client";
import { Turnstile } from "@marsidev/react-turnstile";
import { env } from "@/lib/env";

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  return (
    <Turnstile
      siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{ theme: "auto" }}
    />
  );
}
```

Usage pattern in a form:

```tsx
// In any public form component
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

// Render the widget
<TurnstileWidget onSuccess={(token) => setTurnstileToken(token)} />

// Pass the token in the form submission
await signUpAction({ ...formData, turnstileToken });
```

#### Server-side verification helper

Create `src/lib/turnstile.ts`:

```ts
import { env } from "@/lib/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes: string[];
}

/**
 * Verifies a Turnstile challenge token on the server.
 * Call this at the start of every public-facing server action before any
 * business logic. Never cache or reuse tokens.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string
): Promise<TurnstileVerifyResult> {
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };

  const body = new URLSearchParams({
    secret:   env.TURNSTILE_SECRET_KEY,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  const res = await fetch(VERIFY_URL, { method: "POST", body });
  if (!res.ok) return { success: false, errorCodes: ["network-error"] };

  const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
  return {
    success: data.success,
    errorCodes: data["error-codes"] ?? [],
  };
}
```

Usage in a server action:

```ts
// In any public server action (signup, sign-in, invite-accept)
import { verifyTurnstile } from "@/lib/turnstile";
import { headers } from "next/headers";

export async function signUpAction(input: { ... turnstileToken: string }) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? undefined;
  const { success } = await verifyTurnstile(input.turnstileToken, ip);
  if (!success) return { error: "Bot check failed. Please try again." };

  // ... rest of action
}
```

**Test mode:** Cloudflare provides test site keys that always pass or always fail. Use `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` in your test environment.

### 5. Security headers

Create `src/middleware.ts` (merge with the auth middleware from Phase 0-02 — the security headers run on every response):

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Apply security headers to every response
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // geolocation is restricted globally; the clock-in page uses a route-level header override
  // (see next.config.ts headers() for /clock-in route) to allow geolocation only there.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.stripe.com https://*.r2.cloudflarestorage.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  return response;
}
```

Merge into the auth middleware export. Every `NextResponse.next()` and `NextResponse.redirect()` call should pass through `applySecurityHeaders`.

**Note:** Tighten the CSP `script-src` after verifying which third-party scripts are needed. `'unsafe-inline'` and `'unsafe-eval'` are required for React dev mode but should be removed or hash-replaced in production if feasible.

Also add headers in `next.config.ts` as a fallback (headers middleware takes precedence but this covers static files), and add the route-specific geolocation override for the clock-in page:

```ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Allow geolocation only on the clock-in route (Phase 2).
        // All other routes inherit the global geolocation=() policy from middleware.
        source: "/[locale]/clock-in/:path*",
        headers: [
          { key: "Permissions-Policy", value: "geolocation=(self)" },
        ],
      },
    ];
  },
};
```

### 6. i18n shell with `next-intl`

Install:

```bash
pnpm add next-intl
```

#### File structure

```
src/
  i18n/
    routing.ts           # locale config
    request.ts           # server-side locale resolution
  messages/
    en.json              # English strings (empty object to start)
    fr.json              # French strings (empty object to start)
  app/
    [locale]/
      layout.tsx         # wraps with NextIntlClientProvider
      page.tsx
```

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
});
```

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "en" | "fr")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Locale resolution order:**
1. Per-user preference from `User.locale` (set in session)
2. Per-org default from `Organization.defaultLocale`
3. Fall back to `"en"`

In `src/i18n/request.ts`, after the session is available (server components), resolve locale from the session before falling back to the URL segment:

```ts
// Inside the config callback, resolve from session when available
// import { auth } from "@/lib/auth/auth";
// const session = await auth();
// const locale = session?.user?.locale ?? routing.defaultLocale;
```

Create the `[locale]` layout:

```ts
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 7. App shell (dashboard layout)

The app shell is the persistent chrome that wraps every authenticated page: a sidebar with primary navigation and a header with contextual controls. It uses the `(dashboard)` route group so the shell layout is not applied to auth pages or webhooks.

#### File structure

```
src/app/[locale]/
  (dashboard)/
    layout.tsx          # shell layout — sidebar + header + main content slot
    _components/
      Sidebar.tsx       # left nav
      SidebarNavItem.tsx
      Header.tsx        # top bar
      OrgSwitcherStub.tsx
      UserMenuStub.tsx
    dashboard/
      page.tsx
    team/
      page.tsx
    # ... further Phase 1+ routes
  (auth)/
    layout.tsx          # bare layout for sign-in / sign-up pages
    sign-in/
      page.tsx
```

#### Dashboard layout

Create `src/app/[locale]/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from "./_components/Sidebar";
import { Header } from "./_components/Header";
import { requireOrgContext } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header ctx={ctx} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

#### Sidebar

Create `src/app/[locale]/(dashboard)/_components/Sidebar.tsx`:

```tsx
import Link from "next/link";
import { SidebarNavItem } from "./SidebarNavItem";

const NAV_ITEMS = [
  { href: "/dashboard",      label: "Dashboard",      icon: "grid" },
  { href: "/team",           label: "Team",            icon: "users" },
  { href: "/locations",      label: "Locations",       icon: "map-pin" },
  { href: "/schedule",       label: "Schedule",        icon: "calendar" },
  { href: "/jobs",           label: "Jobs",            icon: "briefcase" },
  { href: "/documents",      label: "Documents",       icon: "file-text" },
  { href: "/time-tracking",  label: "Time Tracking",   icon: "clock" },
  { href: "/reports",        label: "Reports",         icon: "bar-chart-2" },
  { href: "/settings",       label: "Settings",        icon: "settings" },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Veracrew
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </nav>
    </aside>
  );
}
```

Create `src/app/[locale]/(dashboard)/_components/SidebarNavItem.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: string; // Lucide icon name — Phase 1 will import from lucide-react
}

export function SidebarNavItem({ href, label }: SidebarNavItemProps) {
  const pathname = usePathname();
  // Match on the last segment, ignoring locale prefix
  const isActive = pathname.split("/").slice(2).join("/").startsWith(href.replace("/", ""));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {/* Icon placeholder — replace with lucide-react in Phase 1 */}
      <span className="h-4 w-4 rounded-sm bg-current opacity-60" aria-hidden />
      {label}
    </Link>
  );
}
```

#### Header

Create `src/app/[locale]/(dashboard)/_components/Header.tsx`:

```tsx
import { OrgSwitcherStub } from "./OrgSwitcherStub";
import { UserMenuStub } from "./UserMenuStub";
import type { OrgContext } from "@/lib/auth/types";

interface HeaderProps {
  ctx: OrgContext;
}

export function Header({ ctx }: HeaderProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <OrgSwitcherStub orgName={ctx.orgName} />
      <div className="flex items-center gap-4">
        {/* Notification bell — wired in Phase 1 */}
        <button
          aria-label="Notifications"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <span className="block h-5 w-5 rounded-full border-2 border-current" aria-hidden />
        </button>
        <UserMenuStub userEmail={ctx.userEmail} />
      </div>
    </header>
  );
}
```

Create `src/app/[locale]/(dashboard)/_components/OrgSwitcherStub.tsx`:

```tsx
// Stub for Phase 0. Phase 1 will replace this with a full dropdown that lists
// all orgs the user belongs to and calls the org-switch server action.
export function OrgSwitcherStub({ orgName }: { orgName: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
        {orgName.charAt(0).toUpperCase()}
      </span>
      {orgName}
    </div>
  );
}
```

Create `src/app/[locale]/(dashboard)/_components/UserMenuStub.tsx`:

```tsx
"use client";
// Stub for Phase 0. Phase 1 will add a dropdown with Profile, Settings, and Sign-out.
export function UserMenuStub({ userEmail }: { userEmail: string }) {
  return (
    <button
      aria-label="User menu"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
    >
      {userEmail.charAt(0).toUpperCase()}
    </button>
  );
}
```

#### `OrgContext` type update

The `Header` and `OrgSwitcherStub` components reference `ctx.orgName` and `ctx.userEmail`. Add these fields to the `OrgContext` type in `src/lib/auth/types.ts` (Phase 0-02):

```ts
export interface OrgContext {
  userId:         string;
  userEmail:      string;   // add if not already present
  orgName:        string;   // add if not already present
  organizationId: string;
  role:           string;
}
```

Populate them in `requireOrgContext()` via the session or a lightweight DB read (cache with `unstable_cache` if needed).

**Note:** Lucide icons are a Phase 1 addition. The sidebar icon slots use inline placeholders now; do not import `lucide-react` in Phase 0.

### 8. PWA scaffold

#### Web App Manifest

Create `public/manifest.json`:

```json
{
  "name": "Veracrew",
  "short_name": "Veracrew",
  "description": "Workforce operations for field teams",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1117",
  "theme_color": "#0f1117",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["business", "productivity"],
  "lang": "en",
  "dir": "ltr",
  "orientation": "portrait"
}
```

Link the manifest in the root `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0f1117" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

#### Service Worker (Workbox)

Install:

```bash
pnpm add next-pwa
```

Configure in `next.config.ts`:

```ts
import withPWA from "next-pwa";

const nextConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Cache API responses for the dashboard (stale-while-revalidate)
      urlPattern: /^https?.*\/api\/(?!webhooks|crons).*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 },
      },
    },
    {
      // Cache static assets (cache-first)
      urlPattern: /\.(?:js|css|woff2|png|svg|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
      },
    },
  ],
})({
  // your existing next.config options here
});

export default nextConfig;
```

#### Offline clock-in queue (IndexedDB shape)

When the user is offline, clock-in events are queued locally and replayed when the connection returns. Define the queue shape now so Phase 2 (clock-in feature) can implement it consistently:

```ts
// src/lib/offline/clock-in-queue.ts
// Conceptual shape — implemented with idb-keyval or Dexie in Phase 2

export interface OfflineClockInEvent {
  id: string;          // client-generated CUID for dedupe
  type: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  userId: string;
  organizationId: string;
  locationId: string;
  jobId?: string;
  shiftAssignmentId?: string;
  timestamp: string;   // ISO string — the moment the user tapped, NOT the replay time
  lat: number;
  lng: number;
  gpsAccuracy?: number;
  deviceUuid: string;  // stable device fingerprint for server-side dedupe
  syncedAt?: string;   // set when the server confirms the event
  syncError?: string;  // set if the server rejected the event
}

// The server uses (deviceUuid + timestamp) as the dedupe key via
// TimeEntry's @@unique([deviceUuid, clockIn]) constraint.
// The client must NEVER change the timestamp on retry — only retry with the original timestamp.
```

---

## Tests required

- [ ] **R2 presign — rate limit enforced**: call `getPresignedUploadUrl` 11 times in a minute with the same user → 11th call returns rate limit error.
- [ ] **R2 presign — org key prefix enforced**: returned `objectKey` starts with `org_{organizationId}/`.
- [ ] **R2 presign — blocked extension rejected**: input with `fileName: "payload.exe"` returns `{ error: "File type not allowed." }` without issuing a presigned URL.
- [ ] **R2 presign — size cap enforced per type**: `fileType: "image"`, `sizeBytes: 30_000_000` (> 25 MB) returns size error; same sizeBytes with `fileType: "document"` passes.
- [ ] **R2 download — cross-org access denied**: user in org A attempts to get presigned URL for an object key belonging to org B → returns `{ error: "Access denied" }`.
- [ ] **R2 download — Content-Disposition set**: the presigned URL is generated with `ResponseContentDisposition` containing `attachment`.
- [ ] **R2 download — DOC_DOWNLOAD audit event created**: after a successful `getPresignedDownloadUrl` call, an `AuditEvent` row with `action = "DOC_DOWNLOAD"` exists.
- [ ] **`finalizeUpload` — size mismatch enqueues R2DeletionJob**: mock R2 HeadObject to return a `ContentLength` that differs significantly from `sizeBytes` → verify an `R2DeletionJob` row is created.
- [ ] **`finalizeUpload` — magic byte mismatch enqueues R2DeletionJob**: mock R2 GetObject range read to return JPEG bytes when `contentType = "application/pdf"` → verify an `R2DeletionJob` row is created.
- [ ] **`finalizeUpload` — rollback enqueues R2DeletionJob**: mock the Prisma `userDocument.create` to throw → verify an `R2DeletionJob` row is created with the correct bucket and objectKey.
- [ ] **`sendEmail` — Resend error throws**: mock Resend to return `{ error: { message: "..." } }` → `sendEmail` throws.
- [ ] **Turnstile — missing token returns error**: `verifyTurnstile(null)` returns `{ success: false }`.
- [ ] **Turnstile — test key always passes**: using the Cloudflare always-pass test key, `verifyTurnstile(token)` returns `{ success: true }`.
- [ ] **Turnstile — test key always fails**: using the Cloudflare always-fail test key, `verifyTurnstile(token)` returns `{ success: false }`.
- [ ] **Security headers — present on every response**: make a GET to `/` and verify `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` headers are set.
- [ ] **i18n — English messages load**: `getMessages()` with locale `"en"` returns the `en.json` object without error.
- [ ] **i18n — French messages load**: `getMessages()` with locale `"fr"` returns the `fr.json` object without error.
- [ ] **i18n — unknown locale falls back to `"en"`**: locale `"de"` resolves to `"en"`.
- [ ] **PWA manifest — accessible**: GET `/manifest.json` returns valid JSON with required `name`, `icons`, `start_url` fields.
- [ ] **App shell — unauthenticated redirect**: accessing `/dashboard` without a session redirects to `/auth/sign-in`.
- [ ] **App shell — inactive org redirect**: `DashboardLayout` with an org in `TRIAL_EXPIRED` state throws `OrgInactiveError` (middleware converts to a redirect to `/billing-expired`).
- [ ] **Sidebar — active nav item highlighted**: `SidebarNavItem` with `href` matching the current pathname receives the active CSS class.

---

## Definition of Done

- [ ] `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner resend @upstash/ratelimit @upstash/redis @marsidev/react-turnstile next-intl next-pwa` installed
- [ ] `src/lib/storage/r2.ts` — R2 client singleton + BUCKETS
- [ ] `src/lib/storage/keys.ts` — object key generators
- [ ] `src/actions/storage/upload.ts` — `getPresignedUploadUrl`, `finalizeUpload`
- [ ] `src/actions/storage/download.ts` — `getPresignedDownloadUrl`
- [ ] `src/lib/email/resend.ts` — Resend singleton + `sendEmail`
- [ ] `src/lib/email/templates/trial-will-end.ts` — EN + FR
- [ ] `src/lib/email/templates/trial-expired.ts` — EN + FR
- [ ] `src/lib/email/templates/welcome-to-paid.ts` — EN + FR
- [ ] `src/lib/email/templates/payment-failed.ts` — EN + FR (with optional retry date)
- [ ] `src/lib/rate-limit.ts` — named Upstash rate limiters
- [ ] `src/lib/turnstile.ts` — `verifyTurnstile` server-side helper
- [ ] `src/components/auth/TurnstileWidget.tsx` — client widget component
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env.example`
- [ ] `src/middleware.ts` — auth middleware + security headers (merged)
- [ ] `next.config.ts` — security headers fallback + `next-pwa` config
- [ ] `src/i18n/routing.ts` — locale config (`en`, `fr`)
- [ ] `src/i18n/request.ts` — server-side locale resolution
- [ ] `src/messages/en.json` and `src/messages/fr.json` — at minimum an empty `{}` each
- [ ] `src/app/[locale]/layout.tsx` — `NextIntlClientProvider` wrapper
- [ ] `public/manifest.json` — valid PWA manifest
- [ ] `public/icons/` — 192×192, 512×512, and 512×512 maskable icons present
- [ ] `src/lib/offline/clock-in-queue.ts` — offline event queue type definitions (no runtime code yet)
- [ ] `src/app/[locale]/(dashboard)/layout.tsx` — shell layout with `requireOrgContext` + `requireOrgActive` guards
- [ ] `src/app/[locale]/(dashboard)/_components/Sidebar.tsx` — sidebar with all 9 nav items
- [ ] `src/app/[locale]/(dashboard)/_components/SidebarNavItem.tsx` — active state highlighting
- [ ] `src/app/[locale]/(dashboard)/_components/Header.tsx` — header with org name and user initial
- [ ] `src/app/[locale]/(dashboard)/_components/OrgSwitcherStub.tsx` — org name stub
- [ ] `src/app/[locale]/(dashboard)/_components/UserMenuStub.tsx` — user email initial button
- [ ] `OrgContext` type includes `userEmail` and `orgName` fields
- [ ] `src/app/[locale]/(auth)/layout.tsx` — bare layout (no sidebar) for auth pages
- [ ] `pnpm build` completes without errors
- [ ] All tests pass: `pnpm vitest run`
- [ ] Manual check: visiting the app on a mobile browser shows "Add to Home Screen" prompt
