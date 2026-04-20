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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { inviteWorker, inviteAdminOrManager } from "@/actions/team/invite";
import type { Role } from "@/generated/prisma/client";

interface InviteDialogProps {
  jobRoles: { id: string; name: string }[];
  isAdmin: boolean;
}

export function InviteDialog({ jobRoles, isAdmin }: InviteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("WORKER");
  const [jobRoleId, setJobRoleId] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    try {
      let result;
      if (role === "WORKER") {
        result = await inviteWorker({ email, jobRoleId: jobRoleId || undefined });
      } else {
        result = await inviteAdminOrManager({ email, role });
      }

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Invite sent to ${email}`);
      setOpen(false);
      setEmail("");
      setRole("WORKER");
      setJobRoleId("");
      router.refresh();
    } catch {
      toast.error("Failed to send invite. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Send an email invitation. They&apos;ll have 7 days to accept.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="worker@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKER">Worker</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                {isAdmin && <SelectItem value="ADMIN">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {role === "WORKER" && jobRoles.length > 0 && (
            <div className="space-y-2">
              <Label>Trade (optional)</Label>
              <Select value={jobRoleId} onValueChange={setJobRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="No trade assigned" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((jr) => (
                    <SelectItem key={jr.id} value={jr.id}>
                      {jr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
