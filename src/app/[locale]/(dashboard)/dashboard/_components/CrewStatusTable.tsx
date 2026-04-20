import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/generated/prisma/client";

const ROLE_COLORS: Record<Role, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  MANAGER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  WORKER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface Member {
  id: string;
  role: Role;
  user: { name: string | null; email: string; image: string | null };
}

interface CrewStatusTableProps {
  members: Member[];
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

export function CrewStatusTable({ members }: CrewStatusTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Active Crew</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No crew members yet. Invite your team to get started.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarImage src={m.user.image ?? undefined} alt={m.user.name ?? m.user.email} />
                      <AvatarFallback className="text-xs">
                        {getInitials(m.user.name, m.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {m.user.name ?? m.user.email}
                      </p>
                      {m.user.name && (
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}
                  >
                    {m.role}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
