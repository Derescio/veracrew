"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CreditCard, Zap, RotateCcw, XCircle } from "lucide-react";
import {
  createCheckoutSession,
  skipTrialCheckout,
  cancelSubscription,
} from "@/actions/billing/checkout";
import type { OrgStatus } from "@/generated/prisma/client";

interface BillingActionsProps {
  orgStatus: OrgStatus;
  hasPaymentMethod: boolean;
  isOwner: boolean;
}

export function BillingActions({ orgStatus, hasPaymentMethod, isOwner }: BillingActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function handleAddCard() {
    setIsPending(true);
    try {
      const result = await createCheckoutSession();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch {
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleSkipTrial() {
    setIsPending(true);
    try {
      const result = await skipTrialCheckout();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch {
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleReactivate() {
    setIsPending(true);
    try {
      const result = await createCheckoutSession();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch {
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleCancel() {
    setIsPending(true);
    try {
      const result = await cancelSubscription({ reason: cancelReason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription cancelled.");
      setCancelOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  const canReactivate = orgStatus === "TRIAL_EXPIRED" || orgStatus === "CANCELLED";
  const isTrialing = orgStatus === "TRIALING";
  const isActive = orgStatus === "ACTIVE" || orgStatus === "PAST_DUE";
  const canCancel = isOwner && (isTrialing || isActive);

  return (
    <div className="flex flex-wrap gap-2">
      {!hasPaymentMethod && isTrialing && (
        <Button onClick={handleAddCard} disabled={isPending}>
          <CreditCard className="mr-2 size-4" />
          Add payment method
        </Button>
      )}

      {isTrialing && (
        <Button variant="outline" onClick={handleSkipTrial} disabled={isPending}>
          <Zap className="mr-2 size-4" />
          Pay now &amp; skip trial
        </Button>
      )}

      {canReactivate && (
        <Button onClick={handleReactivate} disabled={isPending}>
          <RotateCcw className="mr-2 size-4" />
          Reactivate subscription
        </Button>
      )}

      {canCancel && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <XCircle className="mr-2 size-4" />
              Cancel subscription
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel subscription</DialogTitle>
              <DialogDescription>
                {orgStatus === "ACTIVE"
                  ? "Your access will continue until the end of the current billing period."
                  : "Your subscription will be cancelled immediately."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Let us know why you're cancelling…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Keep subscription
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                {isPending ? "Cancelling…" : "Cancel subscription"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
