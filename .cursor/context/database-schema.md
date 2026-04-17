# Veracrew — Database Schema Reference

## Client Setup

```ts
import { prisma } from "@/lib/prisma";
```

Always import the singleton. Never instantiate `PrismaClient` elsewhere.

## Core Models

### User

```text
id, email, name?, image?, createdAt, updatedAt
-> has many memberships, invitations sent, userDocuments, timeEntries, notifications, messages
```

### Organization

```text
id, name, ownerId, createdAt, updatedAt
-> has many memberships, locations, documentTemplates, invites, activityEvents, notifications, jobs
```

### Membership

```text
id, userId, organizationId, role, status?, createdAt, updatedAt
@@unique([userId, organizationId])
@@index([organizationId])
```

Role enum should align with product docs:

```text
OWNER | ADMIN | MANAGER | WORKER
```

### Invite

```text
id, organizationId, email, role, tokenHash, expiresAt, acceptedAt?, invitedById, createdAt
@@index([organizationId, email])
```

### DocumentTemplate

```text
id, organizationId, name, required, description?, fileKey?, createdAt, updatedAt
```

### UserDocument

```text
id, organizationId, userId, templateId, status, fileKey, uploadedAt, approvedAt?, rejectedAt?, expiresAt?
@@index([organizationId, userId])
@@index([templateId])
```

Status enum:

```text
PENDING | SUBMITTED | APPROVED | REJECTED
```

### Location

```text
id, organizationId, name, address, lat, lng, radiusMeters, active, createdAt, updatedAt
@@index([organizationId])
```

### TimeEntry

```text
id, organizationId, userId, locationId, clockIn, clockOut?, status?, submittedAt?, approvedAt?, createdAt, updatedAt
@@index([organizationId, userId, clockIn])
@@index([locationId])
```

### Break

```text
id, timeEntryId, start, end?, createdAt
@@index([timeEntryId])
```

## Next-Phase Models

- `ActivityEvent`
- `Notification`
- `MessageThread`
- `ThreadParticipant`
- `Message`
- `Client`
- `Project`
- `Job`
- `JobAssignment`
- `Invoice`

When these are added, they should remain org-scoped unless there is a strong reason not to.

## Query Rules

### Always select only needed fields

```ts
const member = await prisma.membership.findFirst({
  where: { organizationId, userId },
  select: {
    id: true,
    role: true,
    user: { select: { id: true, name: true, email: true } },
  },
});
```

### Always scope by `organizationId`

```ts
const locations = await prisma.location.findMany({
  where: { organizationId, active: true },
  select: { id: true, name: true, address: true, radiusMeters: true },
  orderBy: { name: "asc" },
});
```

### Verify single-record ownership

```ts
const document = await prisma.userDocument.findFirst({
  where: { id: documentId, organizationId },
  select: { id: true, status: true, userId: true, expiresAt: true },
});
```

### Use `_count` for summary cards and dashboards

```ts
const templates = await prisma.documentTemplate.findMany({
  where: { organizationId },
  select: {
    id: true,
    name: true,
    _count: { select: { userDocuments: true } },
  },
});
```

## Design Rules

1. Org-owned models should carry `organizationId`.
2. Add `createdAt` and `updatedAt` to mutable top-level models.
3. Add indexes for every foreign key and common dashboard filters.
4. Prefer enums for business states over freeform strings.
5. For security-sensitive access, never fetch by `id` alone when the record is org-owned.
