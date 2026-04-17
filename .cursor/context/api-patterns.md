# Veracrew — API & Action Patterns

## Guiding Principle

Every mutation and sensitive read should be written as if cross-tenant leakage is the default failure mode to guard against.

## Auth Direction

- Use NextAuth/Auth.js as the current auth provider.
- Keep provider-specific session access concentrated in `src/auth.ts` and project-local auth helpers.
- Feature code should prefer `requireOrgContext()` and related helpers over importing raw provider APIs directly.

## Server Actions (mutations)

All standard UI mutations should use Server Actions in `src/actions/<feature>.ts`.

### Standard shape

```ts
"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth/context";

const Schema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "MANAGER", "WORKER"]),
});

type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never };

export async function inviteMember(
  formData: FormData
): Promise<ActionResult<{ id: string; email: string }>> {
  const context = await requireOrgContext();
  requireRole(context.role, "ADMIN");

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const invite = await prisma.invite.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: context.organizationId,
        invitedById: context.userId,
      },
      select: { id: true, email: true },
    });

    revalidatePath("/team-members");
    return { data: invite };
  } catch (error) {
    console.error("inviteMember failed", { error });
    return { error: "Failed to invite member" };
  }
}
```

### Rules

- Return `{ data }` on success and `{ error }` on failure.
- Validate with Zod before any DB call.
- Resolve actor identity, active organization, and role from trusted server helpers.
- Never accept `organizationId` from the client for org-bound actions unless the route exists specifically to switch org context and validates membership.
- Wrap Prisma writes in `try/catch`.
- Revalidate the affected route or tag after mutation.

## API Routes

Use API routes only when HTTP semantics are required:

- uploads and signed upload URLs
- email and third-party webhooks
- geofence/time endpoints that rely on request metadata or non-form clients
- long-running integrations

```ts
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ClockInSchema } from "@/lib/validators/time";
import { requireOrgContext } from "@/lib/auth/context";

export async function POST(req: NextRequest) {
  const context = await requireOrgContext();
  const body = await req.json();
  const parsed = ClockInSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      userId: context.userId,
      organizationId: context.organizationId,
      accepted: true,
    },
  });
}
```

## Data Fetching (reads)

Reads live in `src/lib/db/<feature>.ts` and are called from Server Components.

```ts
import { getDashboardSummary } from "@/lib/db/dashboard";
import { requireOrgContext } from "@/lib/auth/context";

export default async function DashboardPage() {
  const context = await requireOrgContext();
  const summary = await getDashboardSummary(context.organizationId);

  return <DashboardSummary summary={summary} />;
}
```

## Permission Pattern

Use a small shared permission layer rather than repeating ad hoc checks:

```ts
const ROLE_LEVEL = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  WORKER: 1,
} as const;
```

Guideline:

- `OWNER` and `ADMIN` can manage org settings and invites.
- `MANAGER` handles operational flows such as approvals, locations, and some messaging.
- `WORKER` performs worker-scoped actions such as clocking in, uploading assigned documents, and messaging managers per policy.

## Response Pattern Summary

| Scenario | Return |
| --- | --- |
| Success | `{ data: T }` |
| Validation error | `{ error: string }` or flattened schema error for API routes |
| Auth / org failure | `{ error: "Unauthorized" }` |
| Role failure | `{ error: "Forbidden" }` or route `403` |
| DB / server error | `{ error: "Failed to <action>" }` |
| Not found | `{ error: "Not found" }` or `null` |
