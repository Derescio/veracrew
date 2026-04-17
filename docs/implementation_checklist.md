# Veracrew — implementation checklist

Use this as a working checklist while building. It mirrors the phased roadmap (foundation through hardening). Check items off as you complete them.

---

## Phase 0 — Foundation

- [ ] Add PostgreSQL + Prisma; versioned migrations from day one
- [ ] Add Prisma client singleton (e.g. `src/lib/prisma.ts`)
- [ ] Implement core schema: `User`, `Organization`, `Membership`, enums for roles aligned to product (Owner / Admin / Manager / Worker)
- [ ] Choose and integrate auth with `NextAuth` / `Auth.js` as the default Phase 0 path; keep local auth helpers so `Clerk` remains a future migration option if needed; session exposes `userId`, active `organizationId`, `role`
- [ ] Org switcher: persist active org (cookie or session) and validate membership on switch
- [ ] Middleware + helpers: `requireOrgContext()`, `assertOrgMembership()`, `assertRole()` / `requireRole()` hierarchy
- [ ] Enforce multi-tenancy: every query filters by `organizationId`; single-record fetches verify org ownership
- [ ] App shell UI: sidebar (Dashboard, Team Members, Locations, Documents, Time Tracking, Reports, Settings)
- [ ] Header: org selector, search entry point (placeholder OK), notification bell, user profile
- [ ] Root layout + `(dashboard)` route group (or equivalent) so authenticated pages share shell
- [ ] `.env.example` with `DATABASE_URL`, auth secrets, and placeholders for email/storage/maps

---

## Phase 1 — Core org and roster

- [ ] Organization create flow (Owner)
- [ ] Invite members (email or magic link token); expiry + single-use where applicable
- [ ] Accept invite → create `Membership` with correct role
- [ ] Team Members page: table, search, filter, status, primary location, documents summary column
- [ ] Server actions or route handlers for invite, role change (with permission checks)
- [ ] Seed or admin script for local demo data (optional)

---

## Phase 2 — Documents and compliance

- [ ] `DocumentTemplate` CRUD (Manager+); required vs optional flag
- [ ] `UserDocument` upload pipeline: signed upload URLs, size/type limits, metadata in DB
- [ ] Status workflow: pending → submitted → approved / rejected
- [ ] Expiry fields and queries for “expired soon” / expired
- [ ] Documents page: summary cards (approved / pending / expired-rejected), Templates tab, Pending Approvals tab
- [ ] Approval actions (Manager+) with audit trail entry

---

## Phase 3 — Locations and geofenced time

- [ ] `Location` model: name, address, lat, lng, radius (meters), active flag, `organizationId`
- [ ] Address → lat/lng (Google Maps Geocoding or equivalent); store coordinates
- [ ] Map placeholder on Locations page; list/grid of locations with edit/delete
- [ ] `TimeEntry` + `Break`: clock in/out, break start/end, optional `clockOut` null = active shift
- [ ] Clock-in API: Haversine distance vs location; reject out of radius; log attempts if flagging abuse
- [ ] Immutability rules for submitted time; optional manager approval for edits
- [ ] Audit events for clock events, edits, approvals
- [ ] Time Tracking page: filters, table, export CSV (stub or real)
- [ ] Dashboard KPIs wired to real aggregates (active members, clock-ins today, pending docs, hours this week)

---

## Phase 4 — Notifications, activity, messaging

### Data

- [ ] `ActivityEvent`: `organizationId`, `actorUserId`, `verb`, `objectType`, `objectId`, `metadata` (JSON), `createdAt`; index `(organizationId, createdAt)`
- [ ] `Notification`: `organizationId`, `userId`, `kind`, `title`, `body`, `readAt`, `severity`, `resourceType`, `resourceId`, `createdAt`, `emailSentAt` or `deliveryFlags` as needed; index `(organizationId, userId, readAt)`
- [ ] `MessageThread`: `organizationId`, `type` (e.g. DIRECT, MANAGER_GROUP), `subject`, optional `jobId`, optional `locationId`, `createdById`, timestamps
- [ ] `ThreadParticipant`: `threadId`, `userId`, `lastReadAt` (and role in thread if useful)
- [ ] `Message`: `threadId`, `senderId`, `body`, optional attachments metadata

### Policy (server-enforced)

- [ ] Manager+ (including Owner/Admin): may create **1:1** with worker and **group** threads (explicit members and/or location-based rules as designed)
- [ ] Worker: may start **1:1** to manager only; may post in threads they are a participant in; **cannot** create org-wide groups
- [ ] All message/notification queries scoped by org + membership

### Product behavior

- [ ] New message → optional fan-out `Notification` rows to other participants (exclude sender)
- [ ] Bell: unread count from DB; list on open; mark read (single + bulk)
- [ ] Dashboard “Recent Activity” reads from `ActivityEvent` (manager-appropriate visibility)
- [ ] Inbox / messages route: list threads, thread detail, compose where policy allows
- [ ] Worker entry point: “Message manager” (resolve default manager or picker if multiple)

### Email (Resend)

- [ ] Wire Resend for: invites, missing documents, shift reminders, **urgent-only** notification classes
- [ ] Do not email every in-app notification; u se kind/severity/flags to gate sends
- [ ] Log or store `emailSentAt` / failure for retries (optional in v1)

### Delivery note (v1)

- [ ] No WebSockets required: load on navigation + manual refresh; document follow-up (SSE/polling) if needed

---

## Phase 5 — Jobs / light CRM and job updates

- [ ] `Client`, `Project` (optional), `Job` with status, schedule window, description, optional `locationId`
- [ ] `JobAssignment` (user ↔ job) with role on job if needed
- [ ] Job list and job detail page (status, schedule, address/location, notes placeholder)
- [ ] Job-scoped thread optional: `MessageThread.jobId` set and participants auto-synced with assignees
- [ ] On job create/update/status/schedule/dispatch: append `ActivityEvent` + create `Notification` for assignees (+ managers per rules)
- [ ] Deep links from notifications to `/jobs/[id]` (or chosen path)

---

## Phase 6 — Pay rules and reporting

- [ ] Org-level pay config: regular multiplier, OT (1.5x), double, holiday rules (toggle + dates or calendar)
- [ ] Compute rolled-up hours and pay from `TimeEntry` + breaks; document rounding rules
- [ ] Reports page: timeframe filter; charts placeholder → real data when ready
- [ ] CSV exports for time, attendance, hours summary (match plan / UX)
- [ ] Caching: avoid caching money/time-sensitive per-user state inappropriately (`no-store` where needed)

---

## Phase 7 — Invoicing and objections

- [ ] `Invoice` linked to `Client`, line items from billable hours / job
- [ ] Generate PDF (server-side); signed download URLs; permission: only authorized roles + involved employee rules per product
- [ ] Objection or dispute note on line item or invoice; notifies managers
- [ ] Status flow: draft → sent → paid / disputed (as you define)

---

## Phase 8 — Hardening and scale

- [ ] Rate limiting on auth, invites, email-sending, clock-in, uploads (e.g. Upstash Redis or equivalent)
- [ ] Background jobs: digest emails, batch compliance scans (expired docs), optional queue (Inngest / QStash / cron)
- [ ] Audit export for admins (CSV or JSON) for critical tables
- [ ] Operational runbook: env vars, migrations, backup, incident basics
- [ ] Security review pass: upload abuse, IDOR on org boundaries, invite token reuse

---

## Cross-cutting (track across phases)

- [ ] Zod validation on all external inputs (actions + API routes)
- [ ] Central shared types (project convention: e.g. `.utils/types/index.ts` or `src/lib/types.ts`)
- [ ] Error boundaries and consistent error UX on dashboard routes
- [ ] Basic Vitest (or chosen runner) for permission helpers and pay math
- [ ] README: how to run DB, migrate, seed, and sign in locally

---

## Definition of done (MVP + messaging + jobs slice)

- [ ] Manager: 1:1 and group messaging within org; worker: 1:1 to manager; policies enforced in API
- [ ] Bell unread count accurate; mark read persists
- [ ] Job change produces activity + in-app notifications for assignees; urgent path can email
- [ ] No cross-tenant data leakage in activity, notifications, or messages
