# Veracrew — Architecture Reference

## What It Is

Veracrew is a multi-tenant workforce operations app for organizations that need:

- team and role management
- document and compliance tracking
- location-based time tracking
- activity, notifications, and lightweight internal messaging
- later expansion into jobs, reporting, payroll logic, and invoicing

## Current Stack Direction

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router + React 19 |
| Language | TypeScript strict |
| Styling | TailwindCSS v4 |
| Database | PostgreSQL + Prisma ORM v7 |
| ORM Client | `@/lib/prisma` singleton once Prisma is added |
| Auth | NextAuth (Auth.js) first; keep app code behind local helpers so Clerk remains a future migration option |
| UI | shadcn/ui primitives + app-specific dashboard components |
| Email | Resend |
| Storage | Signed uploads for PDFs/images via S3, R2, or equivalent |
| Maps | Google Maps or equivalent geocoding + coordinate storage |

## Product Constraints

1. Veracrew is org-scoped, not user-scoped.
2. Users may belong to multiple organizations through `Membership`.
3. The active organization must come from trusted server context, not arbitrary client input.
4. Every sensitive read and write must enforce membership and role rules.
5. Money-, time-, permission-, and notification-sensitive data should avoid unsafe caching.

## Target Folder Structure

```text
src/
  app/
    (dashboard)/
      dashboard/
      team-members/
      locations/
      documents/
      time-tracking/
      reports/
      settings/
      _components/
    api/                    # webhooks, uploads, geofence HTTP endpoints, integrations
  actions/                  # server actions by feature
  components/               # shared reusable UI
  lib/
    prisma.ts               # singleton Prisma client
    db/                     # read-only query helpers
    auth/                   # org context + permission helpers
    validators/             # zod schemas
    utils.ts
.utils/
  types/
    index.ts                # central shared domain types
prisma/
  schema.prisma
docs/
  team_flow.md
  implementation_checklist.md
.cursor/
  rules/
  context/
  agents/
  commands/
  templates/
  examples/
  skills/
```

## Data Flow Rules

1. Reads belong in `src/lib/db/*.ts` and are called from Server Components.
2. Mutations belong in `src/actions/*.ts` as Server Actions unless an HTTP route is genuinely required.
3. API routes are for uploads, webhooks, geofence/time endpoints that need request metadata, or third-party integrations.
4. Client Components receive already-authorized data from Server Components; they should not become the source of tenancy or permission decisions.

## Auth and Org Context

- Start with NextAuth/Auth.js for Phase 0 and export the session utilities from a local `src/auth.ts`.
- Prefer project-local helpers such as `requireOrgContext()`, `assertOrgMembership()`, and `requireRole()` so most of the app does not depend directly on provider APIs.
- The session contract should expose at least `userId`, active `organizationId`, and the resolved membership `role`.
- In application features, prefer reading org context through the helper layer rather than calling raw `auth()` everywhere.
- Org switching must validate membership before persisting the new active org.
- If Veracrew later outgrows NextAuth, Clerk should replace the auth layer behind those same local helpers rather than forcing app-wide rewrites.

## UI Direction

- Use operational dashboard patterns: tables, filters, tabs, cards, badges, dialogs, drawers, and empty states.
- Prioritize clarity over decoration.
- Keep the authenticated shell consistent: sidebar, header, org selector, notifications, and user profile entry point.

## Caching Rules

- Static assets: aggressive caching is fine.
- Org-level lists that change infrequently: short revalidation is acceptable.
- Time tracking, unread counts, permissions, and pay data: prefer `no-store` or explicit revalidation after mutation.
