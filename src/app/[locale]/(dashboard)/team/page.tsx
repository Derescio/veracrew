import { requireOrgContext } from "@/lib/auth/context";
import { scopedPrisma } from "@/lib/db/scoped-prisma";
import { TeamTable } from "./_components/TeamTable";
import { PendingInvitesTable } from "./_components/PendingInvitesTable";
import { InviteDialog } from "./_components/InviteDialog";
import { Separator } from "@/components/ui/separator";

export default async function TeamPage() {
  const ctx = await requireOrgContext();
  const db = scopedPrisma(ctx.organizationId);

  const [members, pendingInvites, jobRoles] = await Promise.all([
    db.membership.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        status: true,
        hourlyRateOverrideCents: true,
        createdAt: true,
        user: { select: { name: true, email: true, image: true } },
        jobRole: { select: { id: true, name: true } },
      },
    }),
    db.invite.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
    db.jobRole.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const isAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const isManager = isAdmin || ctx.role === "MANAGER";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage your crew members and pending invites
          </p>
        </div>
        {isManager && (
          <InviteDialog jobRoles={jobRoles} isAdmin={isAdmin} />
        )}
      </div>

      <TeamTable
        members={members}
        jobRoles={jobRoles}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
        isAdmin={isAdmin}
      />

      {pendingInvites.length > 0 && (
        <>
          <Separator />
          <PendingInvitesTable invites={pendingInvites} isManager={isManager} />
        </>
      )}
    </div>
  );
}
