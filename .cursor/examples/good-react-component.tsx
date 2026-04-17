/**
 * Example: well-formed React components for Veracrew.
 * Shows both Server and Client patterns side by side.
 */

// ─── Server Component — data fetching, no directive ──────────────────────────

import { getPendingApprovals } from "@/lib/db/documents";
import { PendingApprovalCard } from "./pending-approval-card";

interface PendingApprovalsProps {
  organizationId: string;
}

export default async function PendingApprovals({
  organizationId,
}: PendingApprovalsProps) {
  const approvals = await getPendingApprovals(organizationId);

  if (approvals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending document approvals right now.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {approvals.map((approval) => (
        <PendingApprovalCard key={approval.id} approval={approval} />
      ))}
    </div>
  );
}

// ─── Client Component — interactivity only ───────────────────────────────────

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateDocumentStatus } from "@/actions/documents";

interface PendingApprovalCardProps {
  approval: {
    id: string;
    workerName: string;
    templateName: string;
    status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  };
}

export function PendingApprovalCard({ approval }: PendingApprovalCardProps) {
  const [status, setStatus] = useState(approval.status);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setStatus("APPROVED");
    const form = new FormData();
    form.append("documentId", approval.id);
    form.append("status", "APPROVED");

    startTransition(async () => {
      const result = await updateDocumentStatus(form);
      if (result.error) {
        setStatus(approval.status);
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-tight line-clamp-2">
          {approval.workerName}
        </p>
        <Badge
          variant="secondary"
          className={cn(
            status === "APPROVED" && "bg-emerald-500/10 text-emerald-700",
            status === "PENDING" && "bg-amber-500/10 text-amber-700"
          )}
        >
          {status}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">
        {approval.templateName}
      </p>

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          disabled={isPending || status === "APPROVED"}
          onClick={handleApprove}
        >
          Approve
        </Button>
        <p className="text-xs text-muted-foreground line-clamp-2">
          Review documents before final approval.
        </p>
      </div>
    </div>
  );
}
