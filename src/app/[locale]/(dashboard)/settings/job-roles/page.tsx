import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { scopedPrisma } from "@/lib/db/scoped-prisma";
import { JobRolesClient } from "./_components/JobRolesClient";

export default async function JobRolesPage() {
  const ctx = await requireOrgContext();
  requireRole("ADMIN", ctx);

  const db = scopedPrisma(ctx.organizationId);

  const jobRoles = await db.jobRole.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      defaultRegularRateCents: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trades (Job Roles)</h1>
        <p className="text-sm text-muted-foreground">
          Define worker trades and their default pay rates.
        </p>
      </div>
      <JobRolesClient jobRoles={jobRoles} />
    </div>
  );
}
