"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { revokeInvite } from "@/actions/team/invite";
import type { Role } from "@/generated/prisma/client";

interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
}

interface PendingInvitesTableProps {
  invites: Invite[];
  isManager: boolean;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(d);
}

export function PendingInvitesTable({ invites, isManager }: PendingInvitesTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleRevoke(inviteId: string) {
    const result = await revokeInvite({ inviteId });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Invite revoked");
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-medium">Pending Invites</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              {isManager && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="text-sm">{inv.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {inv.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(inv.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(inv.expiresAt)}
                </TableCell>
                {isManager && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRevoke(inv.id)}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Revoke invite</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
