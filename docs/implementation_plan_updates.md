# Veracrew — Implementation Plan Updates

Living document capturing concrete updates to [`architecture.md`](./architecture.md), [`implementation_checklist.md`](./implementation_checklist.md), and [`edge-cases.md`](./edge-cases.md) that resolve gaps surfaced in review. Each item records: the decision, the schema / cron / doc changes required, the phase it lands in, and any open product questions that must be confirmed before execution.

> **Status**: pre-implementation. Nothing in this document is code yet. When an item ships, link to the PR / migration and move the entry to a "Done" section at the bottom of the file.

---

## Decision summary — Batch 1 (data lifecycle)

| # | Gap | Decision |
|---|---|---|
| 1 | No retention for `Message` / `Notification` / `ActivityEvent` | Per-model TTL via `purgeAfter` column + daily purge cron |
| 2 | `AuditEvent` PII vs GDPR right-to-erasure | **Retain indefinitely under legal basis**; do not pseudonymize. Privacy notice language required. |
| 3 | Soft-delete "forever" — no purge cron | Split "UX archive" from "legal retention"; add `legalHoldUntil` column on legal-retention models; daily purge cron respects both `deletedAt` grace windows and legal holds |
| 4 | Prisma FK `onDelete` unspecified | Exhaustive `onDelete` annotation on every relation; CI lint rule blocks new relations without an explicit mode |
| 5 | R2 orphan objects | **Delete R2 on hard-delete only**; soft-delete leaves objects intact. Write-hook enqueues `R2DeletionJob`; monthly reconciler cron catches orphans. |

All five land schema-wise in **Phase 0** (can't retrofit `onDelete` without pain, and `purgeAfter` / `legalHoldUntil` belong in initial migrations). Active crons stagger across Phase 3 / 5 / 8 as noted per item.

---

## 1. Retention policy — `Message`, `Notification`, `ActivityEvent`

### Decision

Per-model TTL. Write-time computed `purgeAfter DateTime` column, indexed alongside `organizationId`. Daily purge cron.

### Retention matrix

| Model | Retention window | Computed `purgeAfter` | Rationale |
|---|---|---|---|
| `Notification` | 90 days from `createdAt` | `createdAt + 90d` | Bell feed is a recency product. No one reopens a notification from two years ago. |
| `Message` | 2 years from `createdAt` by default; **Scale-tier orgs can override** via `Organization.messageRetentionDays` (see "Scale-tier override" below) | `createdAt + Organization.messageRetentionDays (or default 730d)` | Conversation context decays. Scale customers often have longer evidentiary needs; MVP default fits the broad case. |
| `ActivityEvent` | 18 months from `createdAt` | `createdAt + 545d` | Dashboard feed only. `AuditEvent` is the durable record. |

Note on `Message`: MVP simplifies to flat TTL (default 2 years). The "never purge unread" nuance is deferred — field workers don't typically leave messages unread for years; if they do, the data loss is tolerable.

### Scale-tier override (`Organization.messageRetentionDays`)

- New nullable `Int` column on `Organization`; null means "use MVP default of 730 days".
- Editing the value is gated behind `requireFeature("messageRetentionConfig", ctx)` — a new `FeatureFlag` added to `plan-limits.ts` (Scale only in §6.7.1).
- The `scopedPrisma` writer reads the org's value at Message insert and computes `purgeAfter = createdAt + (org.messageRetentionDays ?? 730) days`.
- Reducing the retention only affects **newly-created** messages — existing `purgeAfter` values stand. This keeps the contract simple and avoids retroactive data loss surprise.
- Bounded range: 30 days minimum, 3650 days (10 years) maximum. Zod-enforced at the server action.
- Doc update: add `messageRetentionConfig` to the `FeatureFlag` union in `architecture.md §6.7.1` and to the `SCALE` set in `PLAN_LIMITS`.

### Schema changes — `architecture.md §6.8`

Add to all three models:

```prisma
model Notification {
  // ...existing fields...
  purgeAfter DateTime   // createdAt + retention window; set at insert
  @@index([organizationId, purgeAfter])
}

model Message {
  // ...existing fields...
  purgeAfter DateTime
  @@index([threadId, purgeAfter])   // paired with existing threadId index
}

model ActivityEvent {
  // ...existing fields...
  purgeAfter DateTime
  @@index([organizationId, purgeAfter])
}
```

`purgeAfter` is computed in the `scopedPrisma` extension at insert time — not derived at query time — so the cron hits a covering index. Product can tune retention by updating the writer without a schema migration.

### Cron — `purgeRetentionExpired`

Daily at 02:00 UTC (staggered after billing crons at 00:00 UTC so their audit writes don't race a purge).

```ts
// pseudocode
for model in [Notification, Message, ActivityEvent]:
  while true:
    rows = delete from model
           where purgeAfter < now()
           limit 10_000
           returning organizationId, id
    if rows.length == 0: break
    emit meta audit per org: RETENTION_PURGE { model, count, oldestDeleted }
```

Batched deletes avoid lock contention; meta-audit lets us prove (e.g. to an EU DPA) that retention is enforced on schedule.

### Implementation phases

- Schema (`purgeAfter` column + writer in `scopedPrisma`): **Phase 0**
- Cron: **Phase 5** (first phase with meaningful `Notification` / `Message` / `ActivityEvent` volume)

### Doc updates

- [`architecture.md §6.8`](./architecture.md) — add `purgeAfter` fields + index to all three models
- [`architecture.md §6.10`](./architecture.md) — reframe paragraph: "retention-governed" rather than "partition candidates"; partitioning still a future scale lever
- [`architecture.md §12`](./architecture.md) — cross-reference purge cron
- [`implementation_checklist.md` Phase 0](./implementation_checklist.md) — scaffold for `purgeAfter` writer (same migration that creates each table in its domain phase)
- [`implementation_checklist.md` Phase 5](./implementation_checklist.md) — add `purgeRetentionExpired` cron task
- New §6.11 — see "Cross-cutting" below

---

## 2. `AuditEvent` and GDPR — retain under legal basis

### Decision

`AuditEvent` rows retained **indefinitely** under the explicit legal basis of "payroll / employment-records compliance and fraud prevention." No pseudonymization on user delete. `AuditEvent.actorUserId` keeps referencing the tombstone `User` row (see item 3).

### Rationale

- **Canadian Employment Standards** (ON, BC, AB): 3 years minimum; several provinces trending longer
- **US FLSA**: 3 years payroll records
- **Multi-year audits and wage disputes** are the core selling point — mutating the audit trail on request defeats the product
- **GDPR Article 17(3)(b)** explicitly exempts retention required to comply with legal obligations

### Required doc additions

1. **Privacy policy / ToS language** (web copy, not schema):
   > "Veracrew retains audit records — including references to user identity — indefinitely as required for payroll legal compliance, fraud prevention, and dispute resolution. This retention overrides individual right-to-erasure under GDPR Article 17(3)(b) and equivalent local law."

2. **`architecture.md §12` rewrite**:
   - Current: "Retained indefinitely for MVP (not large at SMB scale)"
   - Target: "Retained indefinitely under explicit legal-basis carve-out. User-delete pipeline (§6.11.2) does NOT erase `AuditEvent`. The pipeline anonymizes PII on the live `User` row; `AuditEvent.actorUserId` continues to resolve to the tombstone row. A user can request an export of their own audit rows (SAR) — export-only, never delete."

3. **SAR (Subject Access Request) flow**: documented server action that streams a user's audit rows as JSON, filtered to `actorUserId = requestingUserId` across all of their memberships. `ADMIN+` can also export per-user under RBAC §5.

### Implementation phases

- Doc edits: **Phase 0**
- SAR export UI: **Phase 8**

### Doc updates

- [`architecture.md §12`](./architecture.md) — rewrite retention paragraph per above
- [`edge-cases.md`](./edge-cases.md) — promote the current GDPR-in-billing-only entry into a full section "GDPR right-to-erasure — scope and carve-outs" covering: `User` (anonymize, see item 3), `Organization`, `Invoice` / `TimeEntry` (legal hold), `AuditEvent` (retained), R2 assets (per item 5)

---

## 3. Soft-delete purge — split "UX archive" from "legal retention"

### Recommended remedy

Soft-delete today conflates two different intents. Separate them explicitly:

| Intent | Signal | Example | Behaviour |
|---|---|---|---|
| **UX archive** | `deletedAt` | `User` (GDPR erasure), `Organization` (account closed) | Hidden from UI, recoverable for a grace period, hard-deleted by cron after the grace |
| **Legal retention** | `legalHoldUntil` | `Invoice`, `TimeEntry` | Never auto-purged while the hold is active, regardless of `deletedAt` |

A row can carry both — e.g. an Invoice inside an `Organization` that's been soft-deleted: the org is on a 90-day cascade path but the Invoice pulls the parent's `legalHoldUntil` through the purge-cascade check.

### Per-model policy

| Model | UX grace → hard-delete | Default `legalHoldUntil` | Purge cron behaviour |
|---|---|---|---|
| `User` | 30 days after `deletedAt` → **tombstone**, not full row delete | — | After 30 days: null `email`, `name`, `image`, `twoFactorSecret`, `twoFactorBackupCodes`; set email to `deleted-user-<cuid>@anon.local`; keep row so FKs resolve |
| `Organization` | 90 days after `deletedAt` (matches existing `CANCELLED` export-grace) | respected if set | Cascade hard-delete per item 4's `onDelete` rules; children with their own `legalHoldUntil` block the cascade and are moved to a detached `archivedOrganizationId` column for later purge |
| `Invoice` | NEVER auto-purged | `createdAt + 7 years` | Soft-delete hides from UI only. After hold expires, SUPERUSER force-delete is the only path. |
| `TimeEntry` | NEVER auto-purged | `createdAt + 7 years` | Same as Invoice |

### Schema changes

```prisma
model User {
  // ...existing...
  // deletedAt already exists; tombstoned-after is implicit (deletedAt + 30d handled by cron)
}

model Organization {
  // ...existing...
  legalHoldUntil         DateTime?
  messageRetentionDays   Int?          // null = use default 730d; Scale-tier gated
}

model Invoice {
  // ...existing...
  legalHoldUntil DateTime?
}

model TimeEntry {
  // ...existing...
  legalHoldUntil DateTime?
}
```

`Invoice.legalHoldUntil` and `TimeEntry.legalHoldUntil` are populated automatically by the `scopedPrisma` writer at insert time (default `createdAt + 7y`). `Organization.legalHoldUntil` is admin-settable only (for customers under active litigation).

### Cron — `purgeSoftDeleted`

Daily at 03:00 UTC (after retention cron at 02:00).

Three passes, each batched:

1. **User tombstone**: `deletedAt < now() - 30d AND email NOT LIKE 'deleted-user-%'` → anonymize PII fields, leave row. Emit `USER_TOMBSTONED` meta-audit.
2. **Organization cascade**: `deletedAt < now() - 90d AND (legalHoldUntil IS NULL OR legalHoldUntil < now())` → follow item 4's `onDelete` cascade; children with live `legalHoldUntil` detach and survive under `archivedOrganizationId`.
3. **Never touches `Invoice` or `TimeEntry`** — those require a SUPERUSER explicit action after the hold expires, with a mandatory reason string. Audit-logged.

### Implementation phases

- Schema (`legalHoldUntil` columns): **Phase 0**
- User tombstone cron: **Phase 8** (pairs with SAR pipeline)
- Org cascade purge cron: **Phase 8** (depends on item 4's `onDelete` matrix being in place)
- SUPERUSER force-delete server action: **Phase 8**

### Doc updates

- [`architecture.md §6.1`](./architecture.md) — add `legalHoldUntil` to `Organization`
- [`architecture.md §6.5`](./architecture.md) — add `legalHoldUntil` to `TimeEntry`
- [`architecture.md §6.6`](./architecture.md) — add `legalHoldUntil` to `Invoice`
- New [`architecture.md §6.11`](./architecture.md) "Retention and purge policy" — see "Cross-cutting" below
- [`implementation_checklist.md` Phase 0](./implementation_checklist.md) — schema columns
- [`implementation_checklist.md` Phase 8](./implementation_checklist.md) — purge crons + SUPERUSER force-delete
- [`edge-cases.md`](./edge-cases.md) — new entries: "User tombstone semantics", "Organization cascade with child legal hold"

---

## 4. Prisma FK `onDelete` — exhaustive pass

### Principle

Every FK gets an explicit `onDelete`. CI lint rule rejects any Prisma relation added without an explicit mode.

Allowed modes:

- **`Cascade`**: child has no meaning without parent (e.g. `Break` → `TimeEntry`)
- **`Restrict`**: child is legal-retention evidence OR deletion must be handled by pipeline code (e.g. `TimeEntry` → `User`)
- **`SetNull`**: child survives; link is optional (e.g. `Job.projectId`)
- **`NoAction`**: only when none of the above fits; document why inline

### Canonical matrix (all tenant-scoped FKs)

> **This matrix is the new §6.11.1 of `architecture.md`.** When a model is added to the schema, a row is added here in the same PR.

| Model.field → target | `onDelete` | Rationale |
|---|---|---|
| `Membership.userId → User` | `Restrict` | User-delete pipeline must handle cascade (emits audit, tombstones); raw FK cascade would bypass that |
| `Membership.organizationId → Organization` | `Cascade` | Org-purge cron removes memberships alongside the org |
| `Membership.jobRoleId → JobRole` | **`Restrict`** (see open question #1) | Prevent silent zero-rate paychecks when an admin deletes a used JobRole |
| `Invite.organizationId → Organization` | `Cascade` | Pending invites don't outlive the org |
| `JobRole.organizationId → Organization` | `Cascade` | Scope-owned |
| `Location.organizationId → Organization` | `Cascade` | Scope-owned |
| `Shift.locationId → Location` | `Restrict` | Historic `TimeEntry` links through `ShiftAssignment`; block raw location delete |
| `Shift.jobRoleId → JobRole` | `Restrict` | Same rationale as `Membership.jobRoleId` |
| `Shift.organizationId → Organization` | `Cascade` | Scope-owned |
| `ShiftAssignment.shiftId → Shift` | `Cascade` | No meaning without shift |
| `Team.organizationId → Organization` | `Cascade` | Scope-owned |
| `TeamMember.teamId → Team` | `Cascade` | `Team` soft-delete (the normal path) leaves `TeamMember` alone; only a true hard-delete cascades |
| `TeamMember.userId → User` | `Restrict` | Block raw user delete; pipeline removes `TeamMember` rows first |
| `Client.organizationId → Organization` | `Cascade` | Scope-owned |
| `Project.clientId → Client` | `Restrict` | Don't orphan jobs; require manual resolution |
| `Project.organizationId → Organization` | `Cascade` | Scope-owned |
| `Job.clientId → Client` | `Restrict` | Client delete requires invoice/job cleanup first |
| `Job.projectId → Project` | `SetNull` | Project is optional on Job |
| `Job.locationId → Location` | `SetNull` | Location is optional on Job |
| `Job.organizationId → Organization` | `Cascade` | Scope-owned |
| **`JobAssignment.userId → User`** | **`Restrict`** | **The gap explicitly called out. User-delete pipeline tombstones the User row; `JobAssignment.userId` continues to resolve for audit.** |
| `JobAssignment.jobId → Job` | `Cascade` | No meaning without job |
| `JobAssignment.sourceTeamId → Team` | `SetNull` | If a Team is ever hard-deleted, keep the assignment history |
| `JobActivity.jobId → Job` | `Cascade` | No meaning without job |
| `JobActivity.authorId → User` | `Restrict` | Preserve authorship; pipeline anonymizes User |
| `JobRequiredDocument.jobId → Job` | `Cascade` | No meaning without job |
| `JobRequiredDocument.templateId → DocumentTemplate` | `Restrict` | Block template delete while referenced |
| `DocumentTemplate.organizationId → Organization` | `Cascade` | Scope-owned |
| `UserDocument.userId → User` | `Restrict` | Legal retention; pipeline tombstones User |
| `UserDocument.templateId → DocumentTemplate` | `Restrict` | Block template delete while referenced |
| `UserDocument.jobAssignmentId → JobAssignment` | `SetNull` | Assignment may disappear; doc survives |
| `TimeEntry.userId → User` | `Restrict` | Legal retention — 7 years default |
| `TimeEntry.locationId → Location` | `Restrict` | Legal retention |
| `TimeEntry.jobId → Job` | `SetNull` | Historic; job reference optional |
| `TimeEntry.shiftAssignmentId → ShiftAssignment` | `SetNull` | Historic |
| `Break.timeEntryId → TimeEntry` | `Cascade` | No meaning without parent |
| `PayRule.organizationId → Organization` | `Cascade` | Scope-owned |
| `Holiday.organizationId → Organization` | `Cascade` | Scope-owned |
| `PayrollExport.organizationId → Organization` | `Cascade` | Scope-owned; legal hold handled at org level |
| `Invoice.clientId → Client` | `Restrict` | Legal retention |
| `Invoice.organizationId → Organization` | `Cascade` | Scope-owned; purge cron checks `Invoice.legalHoldUntil` before the cascade and detaches if active |
| `InvoiceLineItem.invoiceId → Invoice` | `Cascade` | No meaning without invoice |
| `OrgSubscription.organizationId → Organization` | `Cascade` | Scope-owned |
| `StripeWebhookEvent` | n/a | No FKs; global table |
| `ActivityEvent.organizationId → Organization` | `Cascade` | Scope-owned; purge cron handles it directly |
| `ActivityEvent.actorUserId → User` | `Restrict` | Preserve authorship |
| `Notification.userId → User` | `Cascade` | Personal; no retention obligation |
| `Notification.organizationId → Organization` | `Cascade` | Scope-owned |
| `MessageThread.organizationId → Organization` | `Cascade` | Scope-owned |
| `ThreadParticipant.threadId → MessageThread` | `Cascade` | No meaning without thread |
| `ThreadParticipant.userId → User` | `Cascade` | Safe to drop on user delete; `Message.senderId` retains authorship |
| `Message.threadId → MessageThread` | `Cascade` | No meaning without thread |
| `Message.senderId → User` | `Restrict` | Preserve authorship; pipeline anonymizes User |
| `AuditEvent.organizationId → Organization` | `Restrict` | Audit survives org purge until legal window closes. Last-to-delete rule: org hard-delete only proceeds if no unexpired audit rows, or after SUPERUSER override. |
| `AuditEvent.actorUserId → User` | `Restrict` | Preserve actor; pipeline anonymizes User |

### CI lint rule

Checklist addition: a `scripts/lint-prisma-relations.ts` step run in CI parses `schema.prisma` and fails if any `@relation` block lacks an `onDelete` attribute. Rationale in commit message should reference this doc's §6.11.1.

### Implementation phase

**Phase 0** — annotations land in the initial migration. Retrofitting `onDelete` rules later is painful.

### Doc updates

- [`architecture.md §6.1` through `§6.9`](./architecture.md) — every `@relation` in the Prisma blocks gains an `onDelete: …` annotation
- New [`architecture.md §6.11.1`](./architecture.md) — the matrix above, as canonical source of truth
- [`implementation_checklist.md` Phase 0](./implementation_checklist.md) — add: "every FK has `onDelete` decided per §6.11.1; CI lint rule `lint-prisma-relations.ts` blocks PRs adding unannotated relations"

---

## 5. R2 orphan cleanup — delete on hard-delete only

### Decision

R2 objects are deleted only when the referencing DB row is **hard-deleted**. Soft-delete leaves R2 intact (cheap; safe if the row is restored).

Two cleanup channels:

1. **Write-hook + queue**: every hard-delete of a model with known R2 keys enqueues a `R2DeletionJob`. A worker processes the queue with retry + DLQ.
2. **Monthly reconciler cron**: lists R2 keys under each `org_{id}/` prefix, cross-references live DB rows, enqueues deletion for keys with no reference and `lastModified > 30 days` ago (avoids racing finalizeUpload).

### Per-resource mapping

| DB field | Bucket | R2 delete fires on |
|---|---|---|
| `UserDocument.fileUrl` | `veracrew-docs-{env}` | `UserDocument` hard-delete (User tombstone cascade OR SUPERUSER force-delete) |
| `JobActivity.attachmentUrl` | `veracrew-images-{env}` | `JobActivity` hard-delete (Job/Org cascade) |
| `Message.attachments[].key` | `veracrew-images-{env}` | `Message` hard-delete (retention purge cron) |
| `PayrollExport.fileUrl` | `veracrew-docs-{env}` | `PayrollExport` hard-delete (Org cascade only; org `legalHoldUntil` must have passed) |
| `Invoice.pdfUrl` | `veracrew-docs-{env}` | `Invoice` hard-delete (rare; requires `legalHoldUntil < now()` and SUPERUSER action) |
| `DocumentTemplate.fileUrl` | `veracrew-docs-{env}` | `DocumentTemplate` hard-delete (admin explicit) |
| `Message.attachments` reference on soft-deleted User | — | **Not triggered** — Message is only hard-deleted by retention cron, not user tombstone |

### Flow

```text
DB write hook (scopedPrisma extension)
  │  detects hard-delete on a model with known R2 keys
  ▼
INSERT INTO R2DeletionJob { bucket, objectKey, reason }
  │
  ▼
Worker consumer (separate process / Vercel function / Cloudflare Queue)
  │  pull batch → DELETE to R2 → mark completedAt
  │  on error: increment attempts, exponential backoff, DLQ after 5 tries
  ▼
Monthly reconciler cron
  │  list R2 keys under org_{id}/; cross-reference live rows
  │  enqueue orphans older than 30 days
```

DB-delete and R2-delete are decoupled — the DB row is the source of truth, R2 deletion is best-effort with retry. A failed R2 delete never blocks a DB delete.

### Schema

```prisma
model R2DeletionJob {
  id          String    @id @default(cuid())
  bucket      String
  objectKey   String
  reason      String                         // e.g. "UserDocument hard-delete"
  sourceModel String?                        // e.g. "UserDocument"; for debugging
  sourceId    String?                        // original row id
  attempts    Int       @default(0)
  lastError   String?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([completedAt, createdAt])
}
```

Global (no `organizationId`) because it's an ops/internal queue; access is SUPERUSER-only. CI test ensures `R2DeletionJob` is NOT in the tenant-scoped model list.

### Implementation phases

- Schema + write-hook in `scopedPrisma` + initial upload-path integration: **Phase 0**
- Worker consumer: **Phase 3** (first phase with real user-facing delete UX — `UserDocument` reject / withdraw)
- Monthly reconciler cron: **Phase 8**

### Doc updates

- [`architecture.md §6` (new subsection)](./architecture.md) — `R2DeletionJob` model + note it's global-scoped
- [`architecture.md §8`](./architecture.md) — new subsection "R2 deletion flow" covering write-hook, worker, reconciler
- [`implementation_checklist.md` Phase 0](./implementation_checklist.md) — schema + write-hook
- [`implementation_checklist.md` Phase 3](./implementation_checklist.md) — worker consumer + DLQ handling
- [`implementation_checklist.md` Phase 8](./implementation_checklist.md) — reconciler cron
- [`edge-cases.md`](./edge-cases.md) — new entries: "R2 orphan from failed `finalizeUpload`", "R2 delete DLQ runbook"

---

## Cross-cutting: new `architecture.md §6.11` "Retention and purge policy"

Items 1–3 are scattered across models today; consolidate them into a single new section so retention lives in one place.

Proposed structure:

- **§6.11.1 Retention matrix** — one table covering every model with a `deletedAt`, `purgeAfter`, or `legalHoldUntil` signal and what happens at each boundary
- **§6.11.2 Column semantics** — the contract for `deletedAt`, `purgeAfter`, `legalHoldUntil`, and their interaction
- **§6.11.3 Crons** — `purgeRetentionExpired`, `purgeSoftDeleted`, `reconcileR2Orphans`; schedules, batch sizes, meta-audit emissions
- **§6.11.4 Legal basis and GDPR interaction** — carve-outs, SAR export, the `AuditEvent` invariant from item 2

Item 4's `onDelete` matrix lives in a sibling **§6.11.5** (same parent section so it's easy to find).

---

## Phase impact summary

| Phase | Work added by these updates |
|---|---|
| Phase 0 | `purgeAfter` and `legalHoldUntil` columns; `R2DeletionJob` model; `onDelete` annotations on every relation; `scopedPrisma` write-hook for `purgeAfter` computation + R2 delete queueing; CI lint rule `lint-prisma-relations.ts`; privacy-notice language drafted |
| Phase 3 | R2 deletion worker consumer; DLQ monitoring |
| Phase 5 | `purgeRetentionExpired` cron (Notification / Message / ActivityEvent) |
| Phase 8 | `purgeSoftDeleted` cron (User tombstone + Org cascade); R2 reconciler cron; SUPERUSER force-delete action; SAR audit-export UI |

---

## Resolved product decisions

All five open questions have been confirmed. Frozen answers:

1. **`Membership.jobRoleId` on JobRole delete** — `Restrict`. Forces admin to reassign workers before deleting a trade. Applied in §4 matrix.
2. **`legalHoldUntil` default of 7 years for `Invoice` / `TimeEntry`** — keep 7 years for MVP (Canada/US markets). Column is per-row mutable and the default lives in the `scopedPrisma` writer, not as a DB default — so raising the default for new rows later is app-code only, no migration. Existing rows can be backfilled by a one-off script if needed. If EU/UK is pursued, bump the writer default to 3650d (10 years).
3. **`Message` retention** — flat 2-year default with a Scale-tier override via `Organization.messageRetentionDays`. Gated by new `FeatureFlag = "messageRetentionConfig"` in `SCALE` only. Bounded 30–3650 days. Only affects newly-created messages. Schema + plumbing documented in §1.
4. **User tombstone display name** — `"former-worker-<last-4-of-cuid>"`. Traceable enough for support, not PII.
5. **`Organization.legalHoldUntil` write access** — `SUPERUSER` only. Prevents a malicious admin from freezing their own org to block audit scrutiny.

---

## Next action

Doc-edit pass complete. Remaining work is code:

- [ ] Phase 0 migration that adds `purgeAfter`, `legalHoldUntil`, `messageRetentionDays` columns, the `R2DeletionJob` model, the new `AuditAction` enum values, and all `onDelete` annotations
- [ ] `scopedPrisma` write extension (retention + legal-hold populators, PII redaction in audit diffs, R2 deletion enqueue on hard-delete)
- [ ] `scripts/lint-prisma-relations.ts` CI lint
- [ ] Crons: `processR2Deletions` (Phase 3), `purgeRetentionExpired` (Phase 5), `purgeSoftDeleted` + `r2Reconciler` (Phase 8)
- [ ] SUPERUSER console + SAR UI (Phase 8)
- [ ] Privacy-notice copy shipped at signup and in `/settings`

---

## Done

Doc-edit pass — Batch 1 data-lifecycle updates applied to `architecture.md`, `implementation_checklist.md`, and `edge-cases.md`.

- Item 1 — Retention policy for `Message` / `Notification` / `ActivityEvent` — `architecture.md` §6.8 schema + §6.11.1 policy + §6.7.1 `messageRetentionConfig` flag
- Item 2 — `AuditEvent` legal-basis retention with PII-redacted diffs — `architecture.md` §12 rewrite + §6.11.4
- Item 3 — Soft-delete split into UX archive vs legal retention via `legalHoldUntil` — `architecture.md` §6.11.2 + schema additions on `Organization` / `Invoice` / `TimeEntry`
- Item 4 — Exhaustive `onDelete` matrix + CI lint rule — `architecture.md` §6.11.5 + annotations on every existing `@relation` + cross-cutting note at top of §6
- Item 5 — R2 deletion flow (enqueue on hard-delete, worker with DLQ, weekly reconciler) — `architecture.md` §8 "Deletion flow" + §6.11.3 + new `R2DeletionJob` model in §6.7
- Checklist updates — Phase 0 schema + writer + lint items; Phase 3 R2 worker; Phase 5 retention purge cron; Phase 8 soft-delete purge + reconciler + SUPERUSER console
- Edge-cases expansion — full GDPR erasure entry, tombstone semantics invariant, Org cascade with child legal hold, R2 orphan from `finalizeUpload`, R2 DLQ runbook

Format for future code shipments: `- Item N — <short title> — PR #… — commit … — shipped <date>`
