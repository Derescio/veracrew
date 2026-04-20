import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgStatus } from "@/generated/prisma/client";

interface BillingBannerProps {
  locale: string;
  status: OrgStatus;
  trialEndsAt: Date | null;
  hasPaymentMethod: boolean;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function BillingBanner({
  locale,
  status,
  trialEndsAt,
  hasPaymentMethod,
}: BillingBannerProps) {
  const billingHref = `/${locale}/settings/billing`;

  if (status === "TRIALING" && !hasPaymentMethod && trialEndsAt) {
    const days = daysUntil(trialEndsAt);
    if (days > 7) return null;

    return (
      <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Your free trial ends in <strong>{days} day{days !== 1 ? "s" : ""}</strong>. Add a payment
          method to keep access.
        </span>
        <Button asChild size="sm" variant="outline" className="ml-auto h-7 shrink-0 border-amber-400 text-xs">
          <Link href={billingHref}>Add card</Link>
        </Button>
      </div>
    );
  }

  if (status === "PAST_DUE") {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Your payment failed. Update your payment method to avoid service interruption.
        </span>
        <Button asChild size="sm" variant="destructive" className="ml-auto h-7 shrink-0 text-xs">
          <Link href={billingHref}>Update card</Link>
        </Button>
      </div>
    );
  }

  if (status === "TRIAL_EXPIRED") {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <X className="size-4 shrink-0" />
        <span>
          Your trial has expired. Your account is read-only until you reactivate.
        </span>
        <Button asChild size="sm" variant="destructive" className="ml-auto h-7 shrink-0 text-xs">
          <Link href={billingHref}>Reactivate</Link>
        </Button>
      </div>
    );
  }

  return null;
}
