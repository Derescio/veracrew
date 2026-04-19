import { prisma } from "@/lib/db/prisma";

// Only allow CUID-safe characters (alphanumeric, underscore, hyphen).
// Rejects anything that could escape the SQL literal.
function escapeSqlLiteral(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid organizationId format: ${value}`);
  }
  return value;
}

/**
 * Runs `fn` inside a transaction with the Postgres session variable
 * `app.current_org_id` set to `organizationId`. Every tenant-scoped table
 * has an RLS policy that enforces this variable, so any query inside `fn`
 * can only see rows belonging to this organization.
 *
 * Uses SET LOCAL (transaction-scoped) so the setting does not leak across
 * connections in PgBouncer / Neon pooler transaction mode.
 *
 * SECURITY: `organizationId` MUST come from `requireOrgContext()` — never
 * from request body, query string, or headers.
 */
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
