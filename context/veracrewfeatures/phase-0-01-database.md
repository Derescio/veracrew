# Phase 0 — Prisma Schema, Migrations, RLS, and scopedPrisma

## Goal

A PostgreSQL database with the full Veracrew schema migrated, Row Level Security active on every tenant-scoped table, and two application-layer primitives working: `withOrgRLS(organizationId, fn)` and `scopedPrisma(organizationId)`. At the end of this slice, a correctly-written query can only see data belonging to its own organization — by design, at the DB level.

## Prerequisites

- Phase 0-00 (environment) is complete. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are set.
- `prisma` is installed: `pnpm add prisma @prisma/client`.
- Read the Prisma 7 upgrade guide before touching any code: all breaking changes apply.

---

## Spec

### 1. Schema conventions (non-negotiable)

Every model MUST follow these rules or the CI lint will fail:

| Rule | Detail |
|---|---|
| Primary keys | `@id @default(cuid())` — CUIDs only, never auto-increment |
| `organizationId` | Every tenant-scoped model has `organizationId String` as a non-optional field |
| Money | Stored as `Int` (integer cents). `Float` is **banned** for any financial value |
| Multipliers | Stored as basis points (`Int`). 1.5× = `15000`. 2.0× = `20000` |
| `onDelete` | Every `@relation` MUST declare an explicit `onDelete`. CI lint blocks any PR that skips this |
| Soft-delete | Only these models have `deletedAt DateTime?`: `User`, `Organization`, `Invoice`, `TimeEntry`, `Team` |
| Timestamps | Every model has `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` (except audit/event models that are append-only) |

### 2. Full Prisma schema

Implement the schema below in `prisma/schema.prisma`. **Do not add models not listed here** — Phase 1+ schemas land in their own migrations.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}

// ─── NextAuth models ──────────────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Identity & tenancy ───────────────────────────────────────────────────────

model User {
  id                   String    @id @default(cuid())
  email                String    @unique
  name                 String?
  image                String?
  locale               String?   // "en" | "fr" — overrides org default
  twoFactorEnabled     Boolean   @default(false)
  twoFactorSecret      String?   // encrypted at rest
  twoFactorBackupCodes String[]  // hashed with bcrypt (10 codes, each single-use)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  deletedAt            DateTime?

  memberships Membership[]
  accounts    Account[]
  sessions    Session[]
}

model Organization {
  id                   String            @id @default(cuid())
  name                 String
  country              String            // ISO-3166
  timezone             String            // IANA tz
  defaultLocale        String            @default("en")
  currency             String            @default("USD") // ISO-4217
  clockInGatePolicy    ClockInGatePolicy @default(SOFT_WARNING)
  conflictPolicy       ConflictPolicy    @default(WARN)
  status               OrgStatus         @default(TRIALING)
  stripeCustomerId     String?           @unique
  legalHoldUntil       DateTime?         // SUPERUSER-only; blocks org cascade purge
  messageRetentionDays Int?              // null = default 730d; Scale-tier feature

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  memberships  Membership[]
  locations    Location[]
  jobRoles     JobRole[]
  invites      Invite[]
  payRules     PayRule[]
  holidays     Holiday[]
  teams        Team[]
  subscription OrgSubscription?
  clients      Client[]
  documentTemplates DocumentTemplate[]
}

enum ClockInGatePolicy {
  HARD_BLOCK
  SOFT_WARNING
}

enum ConflictPolicy {
  BLOCK
  WARN
}

enum OrgStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  TRIAL_EXPIRED
  CANCELLED
  SUSPENDED
}

model Membership {
  id                     String       @id @default(cuid())
  userId                 String
  organizationId         String
  role                   Role         @default(WORKER)
  jobRoleId              String?
  hourlyRateOverrideCents Int?
  status                 MemberStatus @default(ACTIVE)
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  jobRole      JobRole?     @relation(fields: [jobRoleId], references: [id], onDelete: Restrict)

  @@unique([userId, organizationId])
  @@index([organizationId, role])
  @@index([organizationId, jobRoleId])
}

enum Role {
  OWNER
  ADMIN
  MANAGER
  WORKER
}

enum MemberStatus {
  ACTIVE
  SUSPENDED
}

model Invite {
  id             String    @id @default(cuid())
  organizationId String
  email          String
  role           Role
  jobRoleId      String?
  token          String    @unique
  invitedById    String
  expiresAt      DateTime
  acceptedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, email])
  // Raw SQL migration adds a partial unique index:
  // CREATE UNIQUE INDEX invite_pending_unique ON "Invite" ("organizationId", "email")
  // WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
}

model JobRole {
  id                      String   @id @default(cuid())
  organizationId          String
  name                    String   // "Foreman", "Apprentice", "Electrician"
  defaultRegularRateCents Int
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  memberships  Membership[]
  shifts       Shift[]

  @@unique([organizationId, name])
  @@index([organizationId])
}

// ─── Locations ────────────────────────────────────────────────────────────────

model Location {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  address        String
  lat            Float
  lng            Float
  radiusMeters   Int      @default(100)
  timezone       String   // IANA tz — overrides org default at this site
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  shifts       Shift[]
  jobs         Job[]
  timeEntries  TimeEntry[]

  @@index([organizationId, isActive])
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

model Shift {
  id             String    @id @default(cuid())
  organizationId String
  locationId     String
  name           String
  recurrenceRule String    // iCal RRULE string
  startTimeLocal String    // "06:00"
  endTimeLocal   String    // "15:00"
  jobRoleId      String?
  effectiveFrom  DateTime
  effectiveTo    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  location     Location     @relation(fields: [locationId], references: [id], onDelete: Restrict)
  jobRole      JobRole?     @relation(fields: [jobRoleId], references: [id], onDelete: Restrict)
  assignments  ShiftAssignment[]

  @@index([organizationId, locationId, effectiveFrom])
}

model ShiftAssignment {
  id             String    @id @default(cuid())
  organizationId String
  shiftId        String
  userId         String
  effectiveFrom  DateTime
  effectiveTo    DateTime?
  createdAt      DateTime  @default(now())

  shift Shift @relation(fields: [shiftId], references: [id], onDelete: Cascade)

  @@index([organizationId, userId, effectiveFrom])
  @@index([shiftId])
}

model Team {
  id                String    @id @default(cuid())
  organizationId    String
  name              String
  description       String?
  defaultLocationId String?
  defaultJobRoleId  String?
  isActive          Boolean   @default(true)
  createdById       String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime? // soft-delete so historic sourceTeamId still resolves

  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members        TeamMember[]
  jobAssignments JobAssignment[]

  @@unique([organizationId, name])
  @@index([organizationId, isActive])
}

model TeamMember {
  id             String   @id @default(cuid())
  organizationId String
  teamId         String
  userId         String
  roleOnTeam     String?
  addedById      String
  addedAt        DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([organizationId, userId])
  @@index([teamId])
}

model Client {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  contactEmail   String?
  contactPhone   String?
  address        String?
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  jobs         Job[]
  invoices     Invoice[]

  @@index([organizationId])
}

model Project {
  id             String   @id @default(cuid())
  organizationId String
  clientId       String
  name           String
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  client       Client       @relation(fields: [clientId], references: [id], onDelete: Restrict)
  jobs         Job[]

  @@index([organizationId, clientId])
}

model Job {
  id             String    @id @default(cuid())
  organizationId String
  clientId       String
  projectId      String?
  locationId     String?
  title          String
  description    String?
  status         JobStatus @default(DRAFT)
  scheduledStart DateTime?
  scheduledEnd   DateTime?
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization      Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  client            Client                @relation(fields: [clientId], references: [id], onDelete: Restrict)
  project           Project?              @relation(fields: [projectId], references: [id], onDelete: SetNull)
  location          Location?             @relation(fields: [locationId], references: [id], onDelete: SetNull)
  assignments       JobAssignment[]
  requiredDocuments JobRequiredDocument[]
  activities        JobActivity[]
  timeEntries       TimeEntry[]

  @@index([organizationId, status, scheduledStart])
  @@index([organizationId, clientId])
}

enum JobStatus {
  DRAFT
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model JobAssignment {
  id                     String   @id @default(cuid())
  organizationId         String
  jobId                  String
  userId                 String
  roleOnJob              String?
  assignedById           String
  assignedAt             DateTime @default(now())
  sourceTeamId           String?
  conflictOverridden     Boolean  @default(false)
  conflictOverrideReason String?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  job          Job          @relation(fields: [jobId], references: [id], onDelete: Cascade)
  team         Team?        @relation(fields: [sourceTeamId], references: [id], onDelete: SetNull)

  @@unique([jobId, userId])
  @@index([organizationId, userId])
  @@index([sourceTeamId])
}

model JobActivity {
  id             String          @id @default(cuid())
  organizationId String
  jobId          String
  authorId       String
  type           JobActivityType
  status         IssueStatus?    // only when type = ISSUE
  body           String
  attachmentUrl  String?         // R2 key
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  job          Job          @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([organizationId, jobId, createdAt])
}

enum JobActivityType {
  ISSUE
  NOTE
  IMAGE
}

enum IssueStatus {
  OPEN
  RESOLVED
}

// ─── Compliance & documents ───────────────────────────────────────────────────

model DocumentTemplate {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  description    String?
  required       Boolean  @default(true)
  expiryMonths   Int?     // null = never expires
  fileUrl        String?  // R2 key for blank form
  jobRoleIds     String[] // empty = applies to all roles
  isStarterPack  Boolean  @default(false)
  starterPackKey String?  // e.g. "ca-construction-basic"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization         Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userDocuments        UserDocument[]
  jobRequiredDocuments JobRequiredDocument[]

  @@index([organizationId])
  @@index([starterPackKey])
}

model UserDocument {
  id              String         @id @default(cuid())
  organizationId  String
  userId          String
  templateId      String
  jobAssignmentId String?
  fileUrl         String         // R2 key
  status          DocumentStatus @default(SUBMITTED)
  submittedAt     DateTime       @default(now())
  expiresAt       DateTime?
  approvedById    String?
  approvedAt      DateTime?
  rejectionReason String?
  scanStatus      ScanStatus     @default(CLEAN)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  organization Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  template     DocumentTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)

  @@index([organizationId, userId, status])
  @@index([organizationId, status, expiresAt])
}

enum DocumentStatus {
  SUBMITTED
  APPROVED
  REJECTED
}

enum ScanStatus {
  PENDING
  CLEAN
  QUARANTINED
}

model JobRequiredDocument {
  id             String                  @id @default(cuid())
  organizationId String
  jobId          String
  templateId     String?
  adhocFileUrl   String?                 // one-off R2 upload
  type           JobRequiredDocumentType
  dueBefore      JobRequiredDocumentDue
  createdAt      DateTime                @default(now())

  organization Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  job          Job               @relation(fields: [jobId], references: [id], onDelete: Cascade)
  template     DocumentTemplate? @relation(fields: [templateId], references: [id], onDelete: Restrict)

  @@index([organizationId, jobId])
}

enum JobRequiredDocumentType {
  FILL_OUT
  REFERENCE
  PRE_EXISTING_REQUIRED
}

enum JobRequiredDocumentDue {
  CLOCK_IN
  SHIFT_END
}

// ─── Time & pay ───────────────────────────────────────────────────────────────

model TimeEntry {
  id                String          @id @default(cuid())
  organizationId    String
  userId            String
  locationId        String
  jobId             String?
  shiftAssignmentId String?
  clockIn           DateTime
  clockOut          DateTime?
  clockInLat        Float
  clockInLng        Float
  gpsAccuracyMeters Int?
  source            TimeEntrySource @default(NORMAL)
  deviceUuid        String?
  flaggedReason     String?
  approvedById      String?
  approvedAt        DateTime?
  submittedAt       DateTime?       // immutable after this
  legalHoldUntil    DateTime?       // set at insert: createdAt + 7y via scopedPrisma writer
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  location     Location     @relation(fields: [locationId], references: [id], onDelete: Restrict)
  job          Job?         @relation(fields: [jobId], references: [id], onDelete: SetNull)
  breaks       Break[]

  @@index([organizationId, userId, clockIn])
  @@index([organizationId, locationId, clockIn])
  @@unique([deviceUuid, clockIn], map: "timeentry_device_event_unique")
}

enum TimeEntrySource {
  NORMAL
  OFFLINE_SYNC
  MANAGER_EDIT
}

model Break {
  id          String    @id @default(cuid())
  timeEntryId String
  start       DateTime
  end         DateTime?

  timeEntry TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)

  @@index([timeEntryId])
}

// Append-only. Past TimeEntry always computes against the rule effective at the time.
model PayRule {
  id                       String    @id @default(cuid())
  organizationId           String
  effectiveFrom            DateTime
  effectiveTo              DateTime?
  otDailyThresholdMinutes  Int?      // e.g. 480 = 8h
  otWeeklyThresholdMinutes Int?      // e.g. 2400 = 40h
  otMultiplierBps          Int       @default(15000) // 1.5×
  doubleMultiplierBps      Int?      // e.g. 20000
  holidayMultiplierBps     Int       @default(20000) // 2.0×
  createdAt                DateTime  @default(now())
  createdById              String

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, effectiveFrom])
}

model Holiday {
  id             String   @id @default(cuid())
  organizationId String
  date           DateTime @db.Date
  name           String

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, date])
  @@index([organizationId])
}

model PayrollExport {
  id             String              @id @default(cuid())
  organizationId String
  periodStart    DateTime
  periodEnd      DateTime
  generatedById  String
  fileUrl        String              // R2 key
  format         PayrollExportFormat
  totalCents     Int
  createdAt      DateTime            @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, periodStart])
}

enum PayrollExportFormat {
  CSV
  JSON
}

// ─── Time-off (schema only; UI and enforcement deferred to post-MVP) ──────────

model TimeOffRequest {
  id             String        @id @default(cuid())
  organizationId String
  userId         String
  startsAt       DateTime
  endsAt         DateTime
  reason         String?
  status         TimeOffStatus @default(PENDING)
  decidedById    String?
  decidedAt      DateTime?
  createdAt      DateTime      @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, userId, startsAt])
  @@index([organizationId, status])
}

enum TimeOffStatus {
  PENDING
  APPROVED
  DECLINED
  CANCELLED
}

// ─── Invoicing (records only — Veracrew never processes money) ────────────────

model Invoice {
  id             String        @id @default(cuid())
  organizationId String
  clientId       String
  number         String
  status         InvoiceStatus @default(DRAFT)
  totalCents     Int
  taxCents       Int           @default(0)
  issueDate      DateTime
  dueDate        DateTime?
  sentAt         DateTime?
  markedPaidAt   DateTime?
  markedPaidById String?
  disputeNotes   String?
  pdfUrl         String?       // R2 key
  createdById    String
  legalHoldUntil DateTime?     // set at insert: createdAt + 7y via scopedPrisma writer
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  client       Client          @relation(fields: [clientId], references: [id], onDelete: Restrict)
  lineItems    InvoiceLineItem[]

  @@unique([organizationId, number])
  @@index([organizationId, status, issueDate])
  @@index([organizationId, clientId])
}

enum InvoiceStatus {
  DRAFT
  SENT
  MARKED_PAID
  DISPUTED
  VOID
}

model InvoiceLineItem {
  id          String          @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int
  unitCents   Int
  amountCents Int
  sourceType  LineItemSource?
  sourceRefId String?

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

enum LineItemSource {
  TIME_ENTRY
  JOB
  MANUAL
}

// ─── Billing (Veracrew revenue) ───────────────────────────────────────────────

model OrgSubscription {
  id                    String   @id @default(cuid())
  organizationId        String   @unique
  stripeSubscriptionId  String   @unique
  stripePriceId         String
  planKey               PlanKey  @default(STARTER) // safety floor; real value set from resolvePlanKey()
  status                String   // mirrors Stripe verbatim: trialing, active, past_due, canceled, etc.
  trialEndsAt           DateTime?
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean  @default(false)
  hasPaymentMethod      Boolean  @default(false)
  requiresPaymentAction Boolean  @default(false) // SCA / 3DS
  seatCount             Int
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

enum PlanKey {
  STARTER
  GROWTH
  SCALE
}

// Stripe webhook dedupe table. Every handler inserts here first; unique violation = already processed.
model StripeWebhookEvent {
  id          String    @id // Stripe event.id (not a cuid)
  type        String
  receivedAt  DateTime  @default(now())
  processedAt DateTime?
  payload     Json

  @@index([type, receivedAt])
}

// Global ops queue — NOT tenant-scoped. Access is SUPERUSER-only.
model R2DeletionJob {
  id          String    @id @default(cuid())
  bucket      String
  objectKey   String
  reason      String
  sourceModel String?
  sourceId    String?
  attempts    Int       @default(0)
  lastError   String?
  completedAt DateTime?
  dlqAt       DateTime? // set after 5 failed attempts
  createdAt   DateTime  @default(now())

  @@index([completedAt, dlqAt, createdAt])
  @@index([bucket, objectKey])
}

// ─── Notifications, activity, messaging ──────────────────────────────────────

model ActivityEvent {
  id             String   @id @default(cuid())
  organizationId String
  actorUserId    String
  verb           String   // "created", "approved", "assigned", "clocked-in"
  objectType     String   // "Job", "UserDocument", "TimeEntry"
  objectId       String
  metadata       Json?
  purgeAfter     DateTime // set at insert: createdAt + 545d via scopedPrisma writer
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, createdAt])
  @@index([organizationId, objectType, objectId])
  @@index([organizationId, purgeAfter])
}

model Notification {
  id             String               @id @default(cuid())
  organizationId String
  userId         String
  kind           String               // "doc.expiring", "shift.reminder", "job.assigned"
  severity       NotificationSeverity @default(NORMAL)
  title          String
  body           String
  resourceType   String?
  resourceId     String?
  readAt         DateTime?
  emailSentAt    DateTime?
  pushSentAt     DateTime?
  purgeAfter     DateTime             // set at insert: createdAt + 90d via scopedPrisma writer
  createdAt      DateTime             @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, userId, readAt])
  @@index([organizationId, purgeAfter])
}

enum NotificationSeverity {
  LOW
  NORMAL
  URGENT
}

model MessageThread {
  id             String     @id @default(cuid())
  organizationId String
  type           ThreadType
  subject        String?
  jobId          String?
  locationId     String?
  createdById    String
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  participants ThreadParticipant[]
  messages     Message[]

  @@index([organizationId, type])
  @@index([organizationId, jobId])
}

enum ThreadType {
  DIRECT
  MANAGER_GROUP
  JOB
}

model ThreadParticipant {
  id         String    @id @default(cuid())
  threadId   String
  userId     String
  lastReadAt DateTime?

  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, userId])
}

model Message {
  id          String   @id @default(cuid())
  threadId    String
  senderId    String
  body        String
  attachments Json?    // array of { key, contentType, sizeBytes }
  purgeAfter  DateTime // set at insert: createdAt + (org.messageRetentionDays ?? 730)d
  createdAt   DateTime @default(now())

  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
  @@index([threadId, purgeAfter])
}

// ─── Audit trail (append-only) ────────────────────────────────────────────────

model AuditEvent {
  id             String      @id @default(cuid())
  organizationId String
  actorUserId    String
  action         AuditAction
  resourceType   String
  resourceId     String
  before         Json?       // PII fields redacted to "[redacted]" by scopedPrisma writer
  after          Json?       // PII fields redacted to "[redacted]" by scopedPrisma writer
  ip             String?
  userAgent      String?
  createdAt      DateTime    @default(now())

  // onDelete: Restrict — audit survives org purge until legal window closes
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  @@index([organizationId, createdAt])
  @@index([organizationId, actorUserId, createdAt])
  @@index([organizationId, resourceType, resourceId])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  APPROVE
  REJECT
  LOGIN
  LOGOUT
  ROLE_CHANGE
  DOC_DOWNLOAD
  PAYROLL_EXPORT
  INVITE_SEND
  INVITE_ACCEPT
  INVITE_REVOKE
  TWO_FACTOR_ENABLE
  TWO_FACTOR_DISABLE
  TWO_FACTOR_RESET
  SUBSCRIPTION_TRIAL_STARTED
  SUBSCRIPTION_PAYMENT_METHOD_ADDED
  SUBSCRIPTION_PAYMENT_METHOD_DETACHED
  SUBSCRIPTION_ACTIVATED
  SUBSCRIPTION_PAYMENT_FAILED
  SUBSCRIPTION_PAST_DUE
  SUBSCRIPTION_TRIAL_EXPIRED
  SUBSCRIPTION_CANCELLED
  SUBSCRIPTION_REACTIVATED
  SUBSCRIPTION_PLAN_CHANGED
  ORG_STATUS_CHANGED
  ORG_REACTIVATE_MANUAL
  TRIAL_EXTENDED
  USER_TOMBSTONED
  ORG_LEGAL_HOLD_SET
  RETENTION_PURGE
  R2_OBJECT_DELETED
  R2_ORPHAN_QUARANTINED
}
```

### 3. Migrations

```bash
# First time (from a clean repo)
pnpm prisma migrate dev --name init

# CI / production deployment
pnpm prisma migrate deploy
```

**Always use `migrate dev` locally, never `db push`.** Migrations are versioned history — every schema change is a new migration file, never an edit to an existing one.

After the initial migration, run a second migration that adds:
1. The partial unique index on `Invite` (raw SQL — Prisma can't express partial indexes):

```sql
CREATE UNIQUE INDEX invite_pending_unique
ON "Invite" ("organizationId", "email")
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
```

2. The RLS setup (see section 4 below).

### 4. Row Level Security (RLS)

Create `prisma/migrations/0002_rls_setup.sql` (applied via `prisma migrate dev`).

#### Concept

For every tenant-scoped table, the database itself enforces that a query can only see rows matching `current_setting('app.current_org_id', true)::text`. This is the third layer of defense — even if a bug in app code sent the wrong `organizationId`, the DB silently returns empty rather than leaking data.

#### Tables that get RLS

All tenant-scoped tables (all tables with `organizationId`):

```
Organization, Membership, Invite, JobRole, Location, Shift, ShiftAssignment,
Team, TeamMember, Client, Project, Job, JobAssignment, JobActivity,
DocumentTemplate, UserDocument, JobRequiredDocument, TimeEntry, Break (via parent),
PayRule, Holiday, PayrollExport, TimeOffRequest, Invoice, InvoiceLineItem,
OrgSubscription, ActivityEvent, Notification, MessageThread, ThreadParticipant,
Message, AuditEvent
```

**NOT tenant-scoped (no RLS):** `User`, `Account`, `Session`, `VerificationToken`, `StripeWebhookEvent`, `R2DeletionJob`

#### SQL pattern for each table

```sql
-- Repeat for every tenant-scoped table. Example: Job
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
FORCE ROW LEVEL SECURITY;  -- table owner cannot bypass in dev
ALTER TABLE "Job" FORCE ROW LEVEL SECURITY;

CREATE POLICY job_tenant_isolation ON "Job"
  USING ("organizationId" = current_setting('app.current_org_id', true)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true)::text);
```

#### `withOrgRLS` wrapper

Create `src/lib/db/with-org-rls.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

function escapeSqlLiteral(value: string): string {
  // Only allow CUID-safe characters (alphanumeric + underscore). Reject anything else.
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid organizationId format: ${value}`);
  }
  return value;
}

export async function withOrgRLS<T>(
  organizationId: string,
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_org_id = '${escapeSqlLiteral(organizationId)}'`
    );
    return fn(tx as unknown as typeof prisma);
  });
}
```

**Security invariant:** `organizationId` passed to `withOrgRLS` MUST come from `requireOrgContext()` (a verified server-side session). Never pass a value from request body, query string, or headers.

**PgBouncer / Neon pooler note:** Use `SET LOCAL` (transaction-scoped), not `SET` (connection-scoped). PgBouncer in transaction mode resets session state between clients — `SET LOCAL` is safe because it is scoped to the transaction lifetime.

### 5. `scopedPrisma` client extension

Create `src/lib/db/scoped-prisma.ts`. This is the app-layer enforcement wrapper — Layer 2 in the three-layer security model.

```ts
import { prisma } from "@/lib/db/prisma";

// Central list of all tenant-scoped models. CI test must fail if a new model
// is added to schema.prisma without also being added here.
export const TENANT_SCOPED_MODELS = new Set([
  "Organization", "Membership", "Invite", "JobRole", "Location",
  "Shift", "ShiftAssignment", "Team", "TeamMember", "Client", "Project",
  "Job", "JobAssignment", "JobActivity", "DocumentTemplate", "UserDocument",
  "JobRequiredDocument", "TimeEntry", "Break", "PayRule", "Holiday",
  "PayrollExport", "TimeOffRequest", "Invoice", "InvoiceLineItem",
  "OrgSubscription", "ActivityEvent", "Notification", "MessageThread",
  "ThreadParticipant", "Message", "AuditEvent",
]);

// PII fields redacted in AuditEvent.before / after
const PII_FIELDS = new Set(["email", "name", "phone", "image", "locale"]);

// Models that emit an AuditEvent on every mutating write.
// Every model in TENANT_SCOPED_MODELS should be here except pure-junction and
// ephemeral models (Notification, ActivityEvent, Message, ThreadParticipant, Break).
const AUDIT_EMIT_MODELS = new Set([
  "Organization", "Membership", "Invite", "JobRole", "Location",
  "Shift", "ShiftAssignment", "Team", "TeamMember", "Client", "Project",
  "Job", "JobAssignment", "JobActivity", "DocumentTemplate", "UserDocument",
  "JobRequiredDocument", "TimeEntry", "PayRule", "Holiday", "PayrollExport",
  "TimeOffRequest", "Invoice", "InvoiceLineItem", "OrgSubscription",
  "MessageThread",
]);

const MUTATING_OPS = new Set(["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"]);

export function scopedPrisma(organizationId: string, actorUserId?: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isTenantModel = model ? TENANT_SCOPED_MODELS.has(model) : false;

          if (isTenantModel) {
            // Inject organizationId on reads and writes
            if (["findUnique", "findFirst", "findMany", "count", "aggregate"].includes(operation)) {
              args.where = { ...(args.where ?? {}), organizationId };
            }
            if (operation === "create") {
              (args as { data: Record<string, unknown> }).data = {
                ...(args as { data: Record<string, unknown> }).data,
                organizationId,
                ...computeRetentionFields(model, args as { data: Record<string, unknown> }),
              };
            }
            if (operation === "createMany") {
              (args as { data: Record<string, unknown>[] }).data = (
                args as { data: Record<string, unknown>[] }
              ).data.map((row) => ({
                ...row,
                organizationId,
                ...computeRetentionFields(model, { data: row }),
              }));
            }
            if (["update", "updateMany"].includes(operation)) {
              args.where = { ...(args.where ?? {}), organizationId };
            }
            if (["delete", "deleteMany"].includes(operation)) {
              args.where = { ...(args.where ?? {}), organizationId };
            }
          }

          // Redact PII in AuditEvent before/after
          if (model === "AuditEvent" && (operation === "create" || operation === "createMany")) {
            redactPiiInAuditArgs(args as { data: Record<string, unknown> });
          }

          // Execute the query first so we can capture the result for the audit diff
          const result = await query(args);

          // Auto-emit AuditEvent for every mutating write on audit-tracked models.
          // Skip if: no actorUserId supplied (internal/system calls), or if this IS
          // an AuditEvent write (prevent infinite recursion).
          if (
            actorUserId &&
            model &&
            AUDIT_EMIT_MODELS.has(model) &&
            MUTATING_OPS.has(operation)
          ) {
            const auditAction = operationToAuditAction(operation);
            const resourceId = extractResourceId(args, result);
            if (auditAction && resourceId) {
              // Fire-and-forget; never let audit failure throw in the parent operation
              prisma.auditEvent
                .create({
                  data: {
                    organizationId,
                    actorUserId,
                    action: auditAction,
                    resourceType: model,
                    resourceId,
                    // before/after are populated by callers that need diffs;
                    // the auto-emit intentionally omits them for bulk operations
                  },
                })
                .catch((err: unknown) => {
                  console.error("[scopedPrisma] AuditEvent emit failed:", err);
                });
            }
          }

          return result;
        },
      },
    },
  });
}

function operationToAuditAction(op: string): string | null {
  if (op === "create" || op === "createMany") return "CREATE";
  if (op === "update" || op === "updateMany" || op === "upsert") return "UPDATE";
  if (op === "delete" || op === "deleteMany") return "DELETE";
  return null;
}

function extractResourceId(args: Record<string, unknown>, result: unknown): string | null {
  // For single-record operations, result has an id field
  if (result && typeof result === "object" && "id" in result) {
    return (result as { id: string }).id;
  }
  // For where-based lookups, try to pull from args
  if (args.where && typeof args.where === "object" && "id" in (args.where as object)) {
    return (args.where as { id: string }).id;
  }
  return null;
}

function computeRetentionFields(
  model: string | undefined,
  args: { data: Record<string, unknown> }
): Record<string, unknown> {
  const now = (args.data.createdAt as Date | undefined) ?? new Date();

  if (model === "Notification") {
    return { purgeAfter: addDays(now, 90) };
  }
  if (model === "ActivityEvent") {
    return { purgeAfter: addDays(now, 545) };
  }
  if (model === "Message") {
    // Organization.messageRetentionDays is resolved at the call site before scopedPrisma create.
    // Pass it via args.data.__retentionDays (sentinel field) then delete it before the DB write.
    const days = typeof args.data.__retentionDays === "number" ? args.data.__retentionDays : 730;
    delete args.data.__retentionDays;
    return { purgeAfter: addDays(now, days) };
  }
  if (model === "TimeEntry") {
    return { legalHoldUntil: addYears(now, 7) };
  }
  if (model === "Invoice") {
    return { legalHoldUntil: addYears(now, 7) };
  }
  return {};
}

function redactPiiInAuditArgs(args: { data: Record<string, unknown> }) {
  for (const jsonField of ["before", "after"] as const) {
    const val = args.data[jsonField];
    if (val && typeof val === "object") {
      const redacted = { ...(val as Record<string, unknown>) };
      for (const key of Object.keys(redacted)) {
        if (PII_FIELDS.has(key)) redacted[key] = "[redacted]";
      }
      args.data[jsonField] = redacted;
    }
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
```

### 6. onDelete matrix (canonical — must be followed in all future migrations)

Every `@relation` must use one of these modes. The CI lint (`scripts/lint-prisma-relations.ts`) blocks any PR that adds a `@relation` without an explicit `onDelete`.

| Model.field → target | `onDelete` | Reason |
|---|---|---|
| `Membership.userId → User` | `Restrict` | User-delete pipeline handles cascade; raw FK cascade would bypass it |
| `Membership.organizationId → Organization` | `Cascade` | Org purge removes memberships |
| `Membership.jobRoleId → JobRole` | `Restrict` | Prevent silent zero-rate paychecks on JobRole delete |
| `Invite.organizationId → Organization` | `Cascade` | Pending invites don't outlive the org |
| `JobRole.organizationId → Organization` | `Cascade` | Scope-owned |
| `Location.organizationId → Organization` | `Cascade` | Scope-owned |
| `Shift.locationId → Location` | `Restrict` | Historic TimeEntry links through ShiftAssignment |
| `Shift.jobRoleId → JobRole` | `Restrict` | Same as Membership.jobRoleId |
| `Shift.organizationId → Organization` | `Cascade` | Scope-owned |
| `ShiftAssignment.shiftId → Shift` | `Cascade` | No meaning without shift |
| `Team.organizationId → Organization` | `Cascade` | Scope-owned |
| `TeamMember.teamId → Team` | `Cascade` | Only hard-delete cascades; soft-delete leaves intact |
| `Client.organizationId → Organization` | `Cascade` | Scope-owned |
| `Project.clientId → Client` | `Restrict` | Don't orphan jobs; require manual resolution |
| `Project.organizationId → Organization` | `Cascade` | Scope-owned |
| `Job.clientId → Client` | `Restrict` | Client delete requires invoice/job cleanup first |
| `Job.projectId → Project` | `SetNull` | Project is optional on Job |
| `Job.locationId → Location` | `SetNull` | Location is optional on Job |
| `Job.organizationId → Organization` | `Cascade` | Scope-owned |
| `JobAssignment.userId → User` | `Restrict` | User-delete pipeline tombstones; assignment history preserved |
| `JobAssignment.jobId → Job` | `Cascade` | No meaning without job |
| `JobAssignment.sourceTeamId → Team` | `SetNull` | Assignment history survives team delete |
| `JobActivity.jobId → Job` | `Cascade` | No meaning without job |
| `JobActivity.authorId → User` | `Restrict` | Preserve authorship; pipeline anonymizes User |
| `JobRequiredDocument.jobId → Job` | `Cascade` | No meaning without job |
| `JobRequiredDocument.templateId → DocumentTemplate` | `Restrict` | Block template delete while referenced |
| `DocumentTemplate.organizationId → Organization` | `Cascade` | Scope-owned |
| `UserDocument.userId → User` | `Restrict` | Legal retention; pipeline tombstones User |
| `UserDocument.templateId → DocumentTemplate` | `Restrict` | Block template delete while referenced |
| `TimeEntry.userId → User` | `Restrict` | Legal retention — 7 years default |
| `TimeEntry.locationId → Location` | `Restrict` | Legal retention |
| `TimeEntry.jobId → Job` | `SetNull` | Historic; job reference optional |
| `Break.timeEntryId → TimeEntry` | `Cascade` | No meaning without parent |
| `PayRule.organizationId → Organization` | `Cascade` | Scope-owned |
| `Holiday.organizationId → Organization` | `Cascade` | Scope-owned |
| `PayrollExport.organizationId → Organization` | `Cascade` | Scope-owned |
| `Invoice.clientId → Client` | `Restrict` | Legal retention |
| `Invoice.organizationId → Organization` | `Cascade` | Scope-owned; purge cron checks legalHoldUntil |
| `InvoiceLineItem.invoiceId → Invoice` | `Cascade` | No meaning without invoice |
| `OrgSubscription.organizationId → Organization` | `Cascade` | Scope-owned |
| `ActivityEvent.organizationId → Organization` | `Cascade` | Scope-owned; purge cron handles it |
| `Notification.userId → User` | `Cascade` | Personal; no retention obligation |
| `Notification.organizationId → Organization` | `Cascade` | Scope-owned |
| `MessageThread.organizationId → Organization` | `Cascade` | Scope-owned |
| `ThreadParticipant.threadId → MessageThread` | `Cascade` | No meaning without thread |
| `Message.threadId → MessageThread` | `Cascade` | No meaning without thread |
| `AuditEvent.organizationId → Organization` | `Restrict` | Audit survives org purge until legal window closes |
| `AuditEvent.actorUserId → User` | `Restrict` | Preserve actor; pipeline anonymizes User |

### 7. CI lint — `scripts/lint-prisma-relations.ts`

Create this script. It parses `schema.prisma` and fails if any `@relation` block lacks an `onDelete` attribute.

```ts
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf-8");
const relationLines = schema
  .split("\n")
  .filter((line) => line.includes("@relation") && !line.trim().startsWith("//"));

const failures = relationLines.filter((line) => !line.includes("onDelete:"));

if (failures.length > 0) {
  console.error("ERROR: These @relation declarations are missing onDelete:");
  failures.forEach((line) => console.error(`  ${line.trim()}`));
  process.exit(1);
}

console.log(`✓ All ${relationLines.length} @relation declarations have onDelete.`);
```

Add to `package.json`:
```json
"scripts": {
  "lint:prisma-relations": "tsx scripts/lint-prisma-relations.ts"
}
```

Add to CI (runs after `prisma validate`).

---

## Tests required

- [ ] **RLS — no context leaks empty**: open a raw DB connection (not through `scopedPrisma`), run `SELECT * FROM "Job" WHERE "organizationId" = '<real-org-id>'` without setting `app.current_org_id` → must return 0 rows.
- [ ] **RLS — wrong org can't read by id**: inside `withOrgRLS(orgB.id, ...)`, attempt `SELECT * FROM "Job" WHERE id = '<job-belonging-to-orgA-id>'` → must return 0 rows.
- [ ] **RLS — correct org reads fine**: inside `withOrgRLS(orgA.id, ...)`, the same job id → returns the row.
- [ ] **SQL escaper rejects bad characters**: `escapeSqlLiteral("' OR '1'='1")` throws; `escapeSqlLiteral("abc123")` passes.
- [ ] **`scopedPrisma` injects `organizationId` on create**: call `db.job.create({ data: { title: "Test" } })` via `scopedPrisma(orgId)` → inspect the DB row to verify `organizationId` was set.
- [ ] **`scopedPrisma` filters on findMany**: create two jobs in different orgs; `scopedPrisma(orgA).job.findMany()` returns only orgA's jobs.
- [ ] **Retention writer — Notification**: creating a Notification via `scopedPrisma` sets `purgeAfter` ≈ `createdAt + 90d`.
- [ ] **Retention writer — Invoice**: creating an Invoice via `scopedPrisma` sets `legalHoldUntil` ≈ `createdAt + 7y`.
- [ ] **PII redaction**: creating an AuditEvent with `before: { email: "user@test.com", name: "Alice" }` stores `"[redacted]"` for both fields.
- [ ] **Audit auto-emit — create fires AuditEvent**: call `scopedPrisma(orgId, actorId).job.create(...)` → an `AuditEvent` row with `action = "CREATE"`, `resourceType = "Job"`, and the new job's `id` as `resourceId` is created.
- [ ] **Audit auto-emit — update fires AuditEvent**: call `scopedPrisma(orgId, actorId).job.update(...)` → `AuditEvent` with `action = "UPDATE"` created.
- [ ] **Audit auto-emit — delete fires AuditEvent**: call `scopedPrisma(orgId, actorId).job.delete(...)` → `AuditEvent` with `action = "DELETE"` created.
- [ ] **Audit auto-emit — no actorUserId, no audit row**: call `scopedPrisma(orgId)` (no actorUserId) `.job.create(...)` → no `AuditEvent` row is created.
- [ ] **Audit auto-emit — AuditEvent write does not recurse**: creating an `AuditEvent` directly does not create a second `AuditEvent`.
- [ ] **CI lint**: `pnpm lint:prisma-relations` exits 0 on a valid schema; exits 1 if you temporarily add a `@relation` without `onDelete`.

---

## Definition of Done

- [ ] `pnpm prisma migrate dev` runs cleanly on the Neon dev branch
- [ ] `pnpm prisma validate` passes
- [ ] `pnpm lint:prisma-relations` passes
- [ ] RLS is enabled on all tenant-scoped tables (verified by checking `pg_tables` + `pg_policies`)
- [ ] `withOrgRLS` passes its integration tests
- [ ] `scopedPrisma` passes its unit tests including retention writers, PII redaction, and audit auto-emit
- [ ] Audit auto-emit: `AUDIT_EMIT_MODELS` set is reviewed and matches the desired tracking scope
- [ ] Calling `scopedPrisma(orgId)` without `actorUserId` does NOT emit AuditEvents (safe for internal/system operations)
- [ ] The `TENANT_SCOPED_MODELS` set in `scoped-prisma.ts` matches the schema (no drift)
- [ ] `R2DeletionJob` is NOT in `TENANT_SCOPED_MODELS` (it's global-ops only)
- [ ] All tests pass: `pnpm vitest run`
