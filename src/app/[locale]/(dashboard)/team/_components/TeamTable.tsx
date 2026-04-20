"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, UserX, UserCheck, LogOut } from "lucide-react";
import { suspendMember, reactivateMember, removeMemberFromOrg } from "@/actions/team/members";
import { useRouter } from "next/navigation";
import type { Role, MemberStatus } from "@/generated/prisma/client";

const ROLE_COLORS: Record<Role, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  MANAGER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  WORKER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface Member {
  id: string;
  role: Role;
  status: MemberStatus;
  hourlyRateOverrideCents: number | null;
  createdAt: Date;
  user: { name: string | null; email: string; image: string | null };
  jobRole: { id: string; name: string } | null;
}

interface TeamTableProps {
  members: Member[];
  jobRoles: { id: string; name: string }[];
  currentUserId: string;
  currentRole: Role;
  isAdmin: boolean;
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return email.charAt(0).toUpperCase();
}

export function TeamTable({ members, currentUserId, isAdmin }: TeamTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleAction(action: () => Promise<{ success: true } | { error: string }>, successMsg: string) {
    const result = await action();
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(successMsg);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No team members yet. Send an invite to get started.
              </TableCell>
            </TableRow>
          )}
          {members.map((m) => {
            const isSelf = m.user.email === currentUserId;
            const isOwner = m.role === "OWNER";

            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarImage src={m.user.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(m.user.name, m.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                      {m.user.name && (
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                    {m.role}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.jobRole?.name ?? <span className="italic">No trade</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "ACTIVE" ? "secondary" : "destructive"} className="text-xs">
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isAdmin && !isSelf && !isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {m.status === "ACTIVE" ? (
                          <DropdownMenuItem
                            className="text-amber-600"
                            onSelect={() =>
                              handleAction(
                                () => suspendMember({ membershipId: m.id }),
                                "Member suspended"
                              )
                            }
                          >
                            <UserX className="mr-2 size-4" />
                            Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              handleAction(
                                () => reactivateMember({ membershipId: m.id }),
                                "Member reactivated"
                              )
                            }
                          >
                            <UserCheck className="mr-2 size-4" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() =>
                            handleAction(
                              () => removeMemberFromOrg({ membershipId: m.id }),
                              "Member removed"
                            )
                          }
                        >
                          <LogOut className="mr-2 size-4" />
                          Remove from org
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
