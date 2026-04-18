# Phase 0 — Auth.js, Session, Tenancy Helpers, and 2FA

## Goal

A fully working authentication system where:
- Users can sign up and sign in with email + password or Google OAuth.
- Every server action and route handler can call `requireOrgContext()` to get a verified org context — never trusting `organizationId` from the client.
- OWNER and ADMIN accounts enforce 2FA (TOTP) before their first privileged action.
- Session rotation happens automatically on sensitive events.

## Prerequisites

- Phase 0-01 (database) is complete. Prisma schema is migrated. `Membership`, `User`, `Account`, `Session`, `VerificationToken` tables exist.
- `DATABASE_URL` is set. All auth-related env vars from Phase 0-00 are set.

---

## Spec

### 1. Install dependencies

```bash
pnpm add next-auth@beta @auth/prisma-adapter argon2
```

Use **NextAuth v5 (beta)** — the App Router-compatible version. Do not use NextAuth v4.

Use **Argon2id** (via the `argon2` package) for password hashing — not bcrypt. Argon2id is the current OWASP recommendation for new projects.

### 2. Auth.js configuration

Create `src/lib/auth/auth.ts` (the central NextAuth config):

```ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { z } from "zod";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(8) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        // Users who signed up via Google have no password — block credential login
        const account = await prisma.account.findFirst({
          where: { userId: user.id, provider: "credentials" },
        });
        if (!account?.access_token) return null;

        const valid = await verifyPassword(parsed.data.password, account.access_token);
        if (!valid) return null;

        return user;
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach org context to the session
      const membership = await prisma.membership.findFirst({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        orderBy: { createdAt: "asc" }, // default to the oldest org
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          locale: (user as { locale?: string }).locale ?? "en",
          twoFactorEnabled: (user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false,
        },
        organizationId: membership?.organizationId ?? null,
        role: membership?.role ?? null,
        jobRoleId: membership?.jobRoleId ?? null,
        membershipId: membership?.id ?? null,
      };
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },
});
```

### 3. Session shape (TypeScript types)

Create `src/lib/auth/types.ts`:

```ts
export type PlatformRole = "OWNER" | "ADMIN" | "MANAGER" | "WORKER";

export interface VeracrewSession {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    locale: "en" | "fr";
    twoFactorEnabled: boolean;
  };
  organizationId: string;
  role: PlatformRole;
  jobRoleId?: string;
  membershipId: string;
  expires: string;
}

// Returned by requireOrgContext(). The verified, trusted org context for a request.
export interface OrgContext {
  userId: string;
  organizationId: string;
  role: PlatformRole;
  jobRoleId?: string;
  membershipId: string;
}
```

Extend NextAuth's built-in types in `src/types/next-auth.d.ts`:

```ts
import type { PlatformRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    organizationId: string | null;
    role: PlatformRole | null;
    jobRoleId?: string | null;
    membershipId: string | null;
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      locale: string;
      twoFactorEnabled: boolean;
    };
  }
}
```

### 4. Password helpers

Create `src/lib/auth/password.ts`:

```ts
import * as argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  try {
    return await argon2.verify(hashed, plain);
  } catch {
    return false;
  }
}
```

### 5. Tenancy helpers

Create `src/lib/auth/context.ts`:

```ts
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { UnauthorizedError, ForbiddenError, NoActiveOrgError } from "@/lib/errors";
import type { OrgContext, PlatformRole } from "@/lib/auth/types";

/**
 * Called at the start of every server action and route handler.
 * Loads the session, re-verifies Membership.status === ACTIVE,
 * and returns a trusted OrgContext.
 *
 * NEVER read organizationId from request.body, params, or headers.
 * Always use the value returned here.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (!session.organizationId || !session.membershipId) throw new NoActiveOrgError();

  // Re-verify membership is still active — catches revocations between requests
  const membership = await prisma.membership.findUnique({
    where: { id: session.membershipId },
    select: { id: true, organizationId: true, userId: true, role: true, jobRoleId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("Membership is no longer active");
  }
  if (membership.organizationId !== session.organizationId) {
    throw new ForbiddenError("Organization context mismatch");
  }
  if (membership.userId !== session.user.id) {
    throw new ForbiddenError("User identity mismatch");
  }

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role as PlatformRole,
    jobRoleId: membership.jobRoleId ?? undefined,
    membershipId: membership.id,
  };
}

const ROLE_RANK: Record<PlatformRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  WORKER: 1,
};

/**
 * Throws ForbiddenError if the context role is below the minimum required role.
 * Usage: requireRole("MANAGER", ctx)
 */
export function requireRole(min: PlatformRole, ctx: OrgContext): void {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[min]) {
    throw new ForbiddenError(`Requires role >= ${min}. Current role: ${ctx.role}`);
  }
}

/**
 * Validates that a user genuinely belongs to a target org.
 * Used during org-switch to prevent a user from switching to an org they aren't in.
 */
export async function assertOrgMembership(
  userId: string,
  organizationId: string
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("User is not an active member of this organization");
  }
}
```

### 6. Error types

Create `src/lib/errors.ts`:

```ts
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NoActiveOrgError extends Error {
  readonly code = "NO_ACTIVE_ORG";
  constructor(message = "No active organization context") {
    super(message);
    this.name = "NoActiveOrgError";
  }
}

export class OrgInactiveError extends Error {
  readonly code = "ORG_INACTIVE";
  readonly status: string;
  readonly organizationId: string;
  constructor(args: { status: string; organizationId: string }) {
    super(`Organization ${args.organizationId} is ${args.status}`);
    this.name = "OrgInactiveError";
    this.status = args.status;
    this.organizationId = args.organizationId;
  }
}

export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT";
  constructor(
    readonly resource: string,
    readonly currentPlan: string
  ) {
    super(`Plan limit reached for ${resource} on plan ${currentPlan}`);
    this.name = "PlanLimitError";
  }
}
```

### 7. Server action pattern

Every server action follows this exact template:

```ts
"use server";
import { requireOrgContext } from "@/lib/auth/context";
import { requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { z } from "zod";

const schema = z.object({ /* ... */ });

export async function myAction(formData: FormData) {
  // 1. Verify org context (session + membership re-check)
  const ctx = await requireOrgContext();

  // 2. Check minimum role (skip for WORKER-accessible actions)
  requireRole("MANAGER", ctx);

  // 3. Check org is allowed to write (not TRIAL_EXPIRED or CANCELLED)
  await requireOrgActive(ctx);

  // 4. Parse and validate input
  const input = schema.parse(Object.fromEntries(formData));

  // 5. Do the work
  // ...

  return { data: result };
}
```

### 8. Org activity middleware

Create `src/lib/auth/org-status.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { OrgInactiveError } from "@/lib/errors";
import type { OrgContext } from "@/lib/auth/types";

/**
 * Must be called after requireOrgContext() in every mutating server action.
 * Do NOT call this in read-only actions or exports.
 *
 * Carveout: closeOpenTimeEntry bypasses this check specifically for TRIAL_EXPIRED
 * and CANCELLED so that a clocked-in field worker can always clock out.
 */
export async function requireOrgActive(ctx: OrgContext): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { status: true },
  });

  if (
    org.status === "ACTIVE" ||
    org.status === "TRIALING" ||
    org.status === "PAST_DUE"
  ) {
    return;
  }

  throw new OrgInactiveError({
    status: org.status,
    organizationId: ctx.organizationId,
  });
}
```

**What each status allows:**

| `Organization.status` | Reads | Exports | Sign-in | New writes | Clock-in | Clock-out (open entry) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `TRIALING` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ACTIVE` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PAST_DUE` | ✓ | ✓ | ✓ | ✓ + red banner | ✓ | ✓ |
| `TRIAL_EXPIRED` | ✓ | ✓ | ✓ | **no** (`OrgInactiveError`) | **no** | ✓ (carveout) |
| `CANCELLED` | export-only | ✓ | ✓ | **no** | **no** | ✓ (carveout) |
| `SUSPENDED` | **no** | **no** | **no** | **no** | **no** | **no** |

### 9. 2FA (TOTP) implementation

2FA is **required** for OWNER and ADMIN. It is optional for MANAGER and WORKER.

Install dependencies:
```bash
pnpm add otpauth qrcode
pnpm add -D @types/qrcode
```

#### Enrollment flow

Create `src/lib/auth/two-factor.ts`:

```ts
import * as OTPAuth from "otpauth";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import QRCode from "qrcode";

const ISSUER = "Veracrew";
const BACKUP_CODE_COUNT = 10;

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export async function generateTotpUri(
  userEmail: string,
  secret: string
): Promise<{ uri: string; qrDataUrl: string }> {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri);
  return { uri, qrDataUrl };
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: "",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  // Allow ±1 window (30 seconds each side) for clock drift
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export async function generateBackupCodes(): Promise<{
  plain: string[];
  hashed: string[];
}> {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase()
  );
  const hashed = await Promise.all(
    plain.map((code) => argon2.hash(code, { type: argon2.argon2id }))
  );
  return { plain, hashed };
}

export async function verifyBackupCode(
  plain: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; usedIndex: number }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await argon2.verify(hashedCodes[i], plain);
    if (match) return { valid: true, usedIndex: i };
  }
  return { valid: false, usedIndex: -1 };
}
```

#### 2FA enforcement rule

After sign-in, check whether 2FA enrollment is required:

```ts
// src/lib/auth/enforce-2fa.ts
import { prisma } from "@/lib/db/prisma";

/**
 * Returns true if the user must complete 2FA enrollment before proceeding.
 * Redirect to /auth/2fa-setup if this returns true.
 */
export async function requires2FASetup(userId: string, role: string): Promise<boolean> {
  if (role !== "OWNER" && role !== "ADMIN") return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });

  return !user?.twoFactorEnabled;
}
```

Middleware check: after any successful sign-in by an OWNER or ADMIN who has `twoFactorEnabled = false`, redirect to `/auth/2fa-setup` before allowing access to any protected route.

#### Storing the TOTP secret

The `twoFactorSecret` field on `User` stores the base32-encoded TOTP secret. It should be encrypted at rest using a server-side key (AES-256-GCM). Create `src/lib/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes = 64 hex chars

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
```

Add `ENCRYPTION_KEY` to `.env.example` (generate with `openssl rand -hex 32`).

### 10. Session rotation

Rotate (invalidate the old session, create a new one) on:

1. Password change
2. 2FA enable / 2FA disable
3. Role change (when an ADMIN promotes someone to OWNER, for example)
4. Org switch (user switching which org is active)

The rotation pattern in NextAuth v5 with database sessions:

```ts
// After any of the above events, delete the current session and force re-auth
await prisma.session.deleteMany({ where: { userId } });
// Then redirect to sign-in or call signIn() server-side
```

### 11. Magic-link (for invite-accept)

The invite-accept flow uses a magic-link (email OTP) rather than a full sign-up form. This allows invited workers who do not yet have a Veracrew account to join in one click.

Magic-link is handled by NextAuth's built-in `Email` provider — wire it up when building the invite system in Phase 1. The Auth.js setup here does not need to include it yet; just leave a comment block in `auth.ts` marking where it will go.

### 12. `tombstoneUser` helper (GDPR erasure)

When a user requests account deletion, personal data must be erased from all **mutable** fields while preserving records that have legal or audit value. The tombstone pattern replaces PII with stable placeholders and revokes all active access.

Create `src/lib/auth/tombstone.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

/**
 * Irreversibly erases a user's PII and revokes all sessions and org memberships.
 * Call only after verifying that the requesting actor is the user themselves
 * (via requireOrgContext or a confirmed email challenge) or is an OWNER of
 * all orgs the user belongs to.
 *
 * Preserves: AuditEvent rows (actorUserId becomes un-linked but the row stays
 * for compliance). TimeEntry, Invoice, and PayrollExport rows retain their
 * foreign key pointing to the now-tombstoned user id — the id is stable.
 */
export async function tombstoneUser(userId: string): Promise<void> {
  // 1. Build the stable tombstone placeholder
  const tombstoneName    = `[deleted-${userId.slice(-8)}]`;
  const tombstoneEmail   = `deleted-${userId.slice(-8)}@tombstone.invalid`;

  await prisma.$transaction(async (tx) => {
    // 2. Revoke all sessions and OAuth accounts immediately
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    // 3. Suspend all memberships so the user can't access any org
    await tx.membership.updateMany({
      where: { userId },
      data: { status: "SUSPENDED" },
    });

    // 4. Revoke any pending invites sent by this user
    await tx.invite.updateMany({
      where: { invitedById: userId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 5. Erase PII from the User row
    await tx.user.update({
      where: { id: userId },
      data: {
        name:              tombstoneName,
        email:             tombstoneEmail,
        image:             null,
        passwordHash:      null,
        twoFactorSecret:   null,
        twoFactorEnabled:  false,
        backupCodes:       [],
        locale:            "en",
        emailVerified:     null,
        deletedAt:         new Date(),
      },
    });
  });
}
```

**Invariants:**
- `userId` remains stable in `AuditEvent`, `TimeEntry`, `Invoice`, `PayrollExport` — we do **not** null it out; the tombstone name/email on the `User` row is sufficient.
- `tombstoneEmail` uses the `.invalid` TLD (RFC 2606) so it can never receive real email.
- The `User.deletedAt` field signals to any future lookup that this is a tombstoned account (Phase 1 will add it to the schema if not already present in the migration).
- This function is idempotent: calling it twice on the same `userId` is safe.

**`deletedAt` schema addition:**

```prisma
model User {
  // ...existing fields...
  deletedAt  DateTime?  // null = active; set = tombstoned
}
```

Add a partial index to prevent tombstoned users from matching email lookups:

```sql
-- prisma/migrations/XXXX_user_deleted_at_index.sql
CREATE INDEX user_active_email ON "User" ("email") WHERE "deletedAt" IS NULL;
```

The Credentials sign-in callback must add `deletedAt: null` to its `findUnique` query to block tombstoned login attempts.

### 13. Route protection (middleware)

Create `src/middleware.ts`:

```ts
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isPublicPage = req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/api/webhooks");

  if (!isAuthenticated && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
```

---

## Tests required

- [ ] **`requireOrgContext` — no session throws `UnauthorizedError`**: call without an active session.
- [ ] **`requireOrgContext` — suspended membership throws `ForbiddenError`**: create a membership with `status = SUSPENDED`, call with a session pointing to it.
- [ ] **`requireOrgContext` — org mismatch throws `ForbiddenError`**: session `organizationId` does not match `membership.organizationId`.
- [ ] **`requireRole` — hierarchy**: `requireRole("ADMIN", { role: "WORKER" })` throws; `requireRole("WORKER", { role: "OWNER" })` passes.
- [ ] **`assertOrgMembership` — non-member throws `ForbiddenError`**: user with no membership for that org.
- [ ] **`requireOrgActive` — TRIAL_EXPIRED throws `OrgInactiveError`**: org with status `TRIAL_EXPIRED`.
- [ ] **`requireOrgActive` — PAST_DUE passes**: org with status `PAST_DUE` does not throw.
- [ ] **TOTP verify — valid token passes**: generate secret, get current TOTP token, verify.
- [ ] **TOTP verify — wrong token fails**: arbitrary 6-digit code fails.
- [ ] **Backup codes — match and remove**: generate codes, verify one by plain text, verify used index is returned; verify the same plain code against remaining hashes fails after removal.
- [ ] **`requires2FASetup` — OWNER without 2FA returns true**: user is OWNER, `twoFactorEnabled = false`.
- [ ] **`requires2FASetup` — WORKER without 2FA returns false**: WORKER role is exempt.
- [ ] **Password hashing round-trip**: `hashPassword("secret")` + `verifyPassword("secret", hash)` = true; wrong password = false.
- [ ] **Encrypt/decrypt round-trip**: `decrypt(encrypt("value"))` === `"value"`.
- [ ] **`tombstoneUser` — erases PII**: after `tombstoneUser(userId)`, the `User` row has a `.invalid` email, null `passwordHash`, and `deletedAt` set.
- [ ] **`tombstoneUser` — deletes sessions**: after `tombstoneUser(userId)`, all `Session` rows for that user are gone.
- [ ] **`tombstoneUser` — suspends memberships**: after `tombstoneUser(userId)`, all `Membership` rows have `status = "SUSPENDED"`.
- [ ] **`tombstoneUser` — is idempotent**: calling `tombstoneUser(userId)` twice does not throw.
- [ ] **Credentials sign-in — tombstoned user blocked**: a user with `deletedAt` set cannot sign in via the Credentials provider.

---

## Definition of Done

- [ ] `pnpm add next-auth@beta @auth/prisma-adapter argon2 otpauth qrcode` installed and `pnpm build` clean
- [ ] `src/lib/auth/auth.ts` — NextAuth v5 config with Credentials + Google providers
- [ ] `src/lib/auth/context.ts` — `requireOrgContext`, `requireRole`, `assertOrgMembership`
- [ ] `src/lib/auth/org-status.ts` — `requireOrgActive`
- [ ] `src/lib/auth/two-factor.ts` — TOTP generate, verify, backup codes
- [ ] `src/lib/auth/enforce-2fa.ts` — `requires2FASetup`
- [ ] `src/lib/auth/password.ts` — Argon2id hash + verify
- [ ] `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt for `twoFactorSecret`
- [ ] `src/lib/errors.ts` — `UnauthorizedError`, `ForbiddenError`, `NoActiveOrgError`, `OrgInactiveError`, `PlanLimitError`
- [ ] `src/middleware.ts` — route protection, auth pages redirect
- [ ] `src/types/next-auth.d.ts` — session type augmentation
- [ ] `src/lib/auth/tombstone.ts` — `tombstoneUser` (PII erasure)
- [ ] `User` model has `deletedAt DateTime?` field and partial index on `(email) WHERE deletedAt IS NULL`
- [ ] Credentials provider sign-in query includes `deletedAt: null` guard
- [ ] All tests pass: `pnpm vitest run`
- [ ] Sign-in with Google works end-to-end in dev (browser test)
- [ ] Sign-in with email + password works end-to-end in dev (browser test)
- [ ] `ENCRYPTION_KEY` added to `.env.example`
