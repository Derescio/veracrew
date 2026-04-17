# Veracrew — Domain Reference

Use this file as the product-level source of truth when planning or implementing features.

## Core Product

Veracrew helps organizations manage workers, compliance, locations, time tracking, internal coordination, and later job and invoicing workflows under one roof.

## Core Entities

- `User`
- `Organization`
- `Membership`
- `Invite`
- `DocumentTemplate`
- `UserDocument`
- `Location`
- `TimeEntry`
- `Break`

## Role Model

- `OWNER`
- `ADMIN`
- `MANAGER`
- `WORKER`

General rule: permissions are hierarchical unless a feature explicitly defines an exception.

## Phase Priorities

### Phase 0

- PostgreSQL + Prisma
- NextAuth/Auth.js setup and org switcher
- org context helpers
- app shell

Auth direction:

- Default to NextAuth/Auth.js now for speed and control.
- Keep the app-layer contract stable so Clerk can be introduced later if growth or product requirements justify it.

### Phase 1

- org creation
- invites
- team members roster

### Phase 2

- document templates
- user document uploads
- approvals and expiry handling

### Phase 3

- locations
- geofenced clock-in/out
- breaks
- dashboard KPI aggregates

### Phase 4

- activity events
- notifications
- internal messaging

### Later

- jobs and light CRM
- pay rules and reporting
- invoicing
- hardening and scale work

## Non-Negotiable Rules

1. No cross-tenant data leakage.
2. Every org-owned record must be filtered or verified by `organizationId`.
3. Single-record fetches still need org ownership checks.
4. Validate all external input with Zod.
5. Treat time, permissions, uploads, and notifications as security-sensitive areas.

## UX Direction

- Mobile first approach for the overall UI
- Dashboard-first operational UI
- clear status indicators
- fast scanning tables and cards
- practical empty states
- minimal decorative complexity
