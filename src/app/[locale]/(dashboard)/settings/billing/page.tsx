import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BillingActions } from "./_components/BillingActions";
import type { OrgStatus } from "@/generated/prisma/client";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

const STATUS_BADGES: Record<OrgStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  TRIALING: { label: "Trial", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  PAST_DUE: { label: "Past Due", variant: "destructive" },
  TRIAL_EXPIRED: { label: "Expired", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
};

export default async function BillingPage() {
  const ctx = await requireOrgContext();
  requireRole("ADMIN", ctx);

  const sub = await prisma.orgSubscription.findUnique({
    where: { organizationId: ctx.organizationId },
    select: {
      planKey: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      hasPaymentMethod: true,
      requiresPaymentAction: true,
      cancelAtPeriodEnd: true,
      organization: { select: { status: true } },
    },
  });

  const orgStatus = (sub?.organization?.status ?? "TRIALING") as OrgStatus;
  const statusBadge = STATUS_BADGES[orgStatus];

  const trialDaysLeft =
    sub?.trialEndsAt && orgStatus === "TRIALING"
      ? daysUntil(sub.trialEndsAt)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment method
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current Plan</CardTitle>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <CardDescription>
            {sub?.planKey ?? "GROWTH"} plan
            {sub?.cancelAtPeriodEnd && (
              <span className="ml-2 text-destructive">
                · Cancels on {formatDate(sub.currentPeriodEnd)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {trialDaysLeft !== null && (
              <div>
                <p className="text-muted-foreground">Trial ends</p>
                <p className="font-medium">
                  {formatDate(sub?.trialEndsAt)} · {trialDaysLeft}d left
                </p>
              </div>
            )}
            {orgStatus === "ACTIVE" && (
              <div>
                <p className="text-muted-foreground">Next renewal</p>
                <p className="font-medium">{formatDate(sub?.currentPeriodEnd)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Payment method</p>
              <p className="font-medium">
                {sub?.hasPaymentMethod ? "Card on file" : "None"}
              </p>
            </div>
          </div>

          <Separator />

          <BillingActions
            orgStatus={orgStatus}
            hasPaymentMethod={sub?.hasPaymentMethod ?? false}
            isOwner={ctx.role === "OWNER"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
