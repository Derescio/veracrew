# Template: Prisma Model

Add to `prisma/schema.prisma`. Run `prisma migrate dev --name <description>` then `prisma generate`.

```prisma
model ModelName {
  id          String  @id @default(cuid())
  name        String
  description String?

  // Org ownership (required for most Veracrew models)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Index every foreign key field
  @@index([organizationId])
}
```

## Schema Conventions

- `@id @default(cuid())` — always use cuid for primary keys
- `@@index` on every foreign key field
- `createdAt` + `updatedAt` on every model
- Nullable fields use `?`
- Boolean defaults are explicit (`@default(false)` or `@default(true)`)
- Model names: `PascalCase`; field names: `camelCase`
- Prefer org-scoped models unless the data is intentionally global or auth-provider-managed
- Use enums for business states (`Role`, `DocumentStatus`, `JobStatus`, etc.)

## After Adding a Model

1. Add the relation to the `Organization` model when the data is org-owned
2. Add related back-relations on `User` if the model belongs to a user actor or assignee
3. Add indexes for common filters and dashboards
4. Run: `npx prisma migrate dev --name add-model-name`
5. Run: `npx prisma generate`
6. Create the db query file: `src/lib/db/<model-name>.ts`
7. Create the actions file: `src/actions/<model-name>.ts`
