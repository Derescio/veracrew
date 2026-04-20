import { requireOrgContext } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { OrgInactiveError, NoActiveOrgError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/AppSidebar";
import { AppHeader } from "./_components/AppHeader";
import { BillingBanner } from "./_components/BillingBanner";
import { auth } from "@/lib/auth/auth";
import type { OrgStatus } from "@/generated/prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = await params;

  let ctx;
  try {
    ctx = await requireOrgContext();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/sign-in`);
    }
    if (error instanceof NoActiveOrgError) {
      redirect(`/${locale}/create-org`);
    }
    throw error;
  }

  try {
    await requireOrgActive(ctx);
  } catch (error) {
    if (error instanceof OrgInactiveError) {
      const passThrough = ["TRIAL_EXPIRED", "PAST_DUE"];
      if (!passThrough.includes(error.orgStatus)) {
        redirect(`/${locale}/billing-expired`);
      }
    } else {
      throw error;
    }
  }

  const session = await auth();
  const userName = session?.user?.name ?? null;

  const subscription = await prisma.orgSubscription.findUnique({
    where: { organizationId: ctx.organizationId },
    select: {
      status: true,
      trialEndsAt: true,
      hasPaymentMethod: true,
      organization: { select: { status: true } },
    },
  });

  const orgStatus = (subscription?.organization?.status ?? "TRIALING") as OrgStatus;
  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const hasPaymentMethod = subscription?.hasPaymentMethod ?? false;

  return (
    <SidebarProvider>
      <AppSidebar
        locale={locale}
        orgName={ctx.orgName}
        userEmail={ctx.userEmail}
        userName={userName}
      />
      <SidebarInset>
        <BillingBanner
          locale={locale}
          status={orgStatus}
          trialEndsAt={trialEndsAt}
          hasPaymentMethod={hasPaymentMethod}
        />
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
