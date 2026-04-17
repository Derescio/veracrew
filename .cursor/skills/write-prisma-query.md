# Skill: write-prisma-query

Write a Prisma query for Veracrew following project conventions.

## Setup

- Always import from `@/lib/prisma` — never instantiate `PrismaClient` directly
- Generated client lives at `@/generated/prisma` (internal to the singleton)
- Read-only queries live in `src/lib/db/<feature>.ts`
- Mutations happen inside Server Actions in `src/actions/<feature>.ts`

## Core Rules

1. **Always `select` explicitly** — never return full records to avoid leaking sensitive fields
2. **Always scope by `organizationId`** for org-owned records, or verify ownership before returning a single record
3. **Wrap mutations in `try/catch`** — Prisma throws on unique violations and relation errors
4. **Use `findUnique` for ID lookups**, `findFirst` for non-unique field filters

## Patterns

### Read — with item count
```ts
const templates = await prisma.documentTemplate.findMany({
  where: { organizationId },
  select: {
    id: true,
    name: true,
    required: true,
    _count: { select: { userDocuments: true } },
  },
  orderBy: { updatedAt: "desc" },
  take: 10,
});
```

### Read — org-owned single record
```ts
const location = await prisma.location.findFirst({
  where: { id: locationId, organizationId },
  select: {
    id: true,
    name: true,
    address: true,
    lat: true,
    lng: true,
    radiusMeters: true,
  },
});
```

### Create — org-scoped record
```ts
try {
  const location = await prisma.location.create({
    data: {
      name,
      address,
      lat,
      lng,
      radiusMeters,
      organizationId,
    },
    select: { id: true, name: true },
  });
  return { data: location };
} catch (error) {
  console.error("createLocation failed", { error });
  return { error: "Failed to create location" };
}
```

### Update — selective fields only
```ts
try {
  await prisma.userDocument.updateMany({
    where: {
      id: documentId,
      organizationId,
    },
    data: { status: "APPROVED" },
  });
  return { data: true };
} catch (error) {
  console.error("approveDocument failed", { error });
  return { error: "Failed to update document" };
}
```

### Delete — verify org ownership first
```ts
await prisma.location.deleteMany({
  where: { id: locationId, organizationId },
});
```

## Schema Quick Reference

| Model      | Key fields                                     | Indexed by       |
| ---------- | ---------------------------------------------- | ---------------- |
| Membership | userId, organizationId, role                   | userId, organizationId |
| Location   | name, address, lat, lng, radiusMeters          | organizationId   |
| TimeEntry  | userId, locationId, clockIn, clockOut          | organizationId, userId, locationId |
| UserDocument | userId, templateId, status, expiresAt        | organizationId, userId, templateId |
| Invite     | email, role, expiresAt, acceptedAt             | organizationId, email |
