import { requireOrgContext } from "@/lib/auth/context";
import { scopedPrisma } from "@/lib/db/scoped-prisma";
import { StatCard } from "./_components/StatCard";
import { CrewStatusTable } from "./_components/CrewStatusTable";
import { AlertsPanel } from "./_components/AlertsPanel";
import { QuickActions } from "./_components/QuickActions";
import { Users, MapPin, FileWarning, Clock } from "lucide-react";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const ctx = await requireOrgContext();
  const db = scopedPrisma(ctx.organizationId);

  const [activeMembersCount, openTimeEntriesCount, pendingDocsCount] = await Promise.all([
    db.membership.count({ where: { status: "ACTIVE" } }),
    db.timeEntry.count({ where: { clockOut: null } }),
    db.userDocument.count({ where: { status: "SUBMITTED" } }),
  ]);

  const recentMembers = await db.membership.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      role: true,
      user: { select: { name: true, email: true, image: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your field operations
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Crew"
          value={activeMembersCount}
          icon={Users}
          iconColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-950"
        />
        <StatCard
          title="On Site"
          value={openTimeEntriesCount}
          icon={MapPin}
          iconColor="text-green-500"
          iconBg="bg-green-50 dark:bg-green-950"
          note="Currently clocked in"
        />
        <StatCard
          title="Pending Docs"
          value={pendingDocsCount}
          icon={FileWarning}
          iconColor="text-amber-500"
          iconBg="bg-amber-50 dark:bg-amber-950"
          note="Awaiting review"
        />
        <StatCard
          title="Hours This Week"
          value="—"
          icon={Clock}
          iconColor="text-purple-500"
          iconBg="bg-purple-50 dark:bg-purple-950"
          note="Live in Phase 3"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Crew status table */}
        <div className="lg:col-span-2">
          <CrewStatusTable members={recentMembers} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <AlertsPanel />
          <QuickActions locale={locale} />
        </div>
      </div>
    </div>
  );
}
