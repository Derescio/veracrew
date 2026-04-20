"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createJobRole, updateJobRole, deleteJobRole } from "@/actions/org/job-roles";

interface JobRole {
  id: string;
  name: string;
  defaultRegularRateCents: number;
  createdAt: Date;
  _count: { memberships: number };
}

interface JobRolesClientProps {
  jobRoles: JobRole[];
}

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function displayToCents(value: string): number {
  return Math.round(parseFloat(value.replace("$", "")) * 100);
}

export function JobRolesClient({ jobRoles: initialRoles }: JobRolesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JobRole | null>(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [isPending, setIsPending] = useState(false);

  function openCreate() {
    setName("");
    setRate("");
    setCreateOpen(true);
  }

  function openEdit(jr: JobRole) {
    setName(jr.name);
    setRate((jr.defaultRegularRateCents / 100).toFixed(2));
    setEditTarget(jr);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await createJobRole({
        name,
        defaultRegularRateCents: displayToCents(rate),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Trade created");
      setCreateOpen(false);
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to create trade.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setIsPending(true);
    try {
      const result = await updateJobRole({
        id: editTarget.id,
        name,
        defaultRegularRateCents: displayToCents(rate),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Trade updated");
      setEditTarget(null);
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to update trade.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(jr: JobRole) {
    if (jr._count.memberships > 0) {
      toast.error(`Cannot delete "${jr.name}" — ${jr._count.memberships} member(s) assigned.`);
      return;
    }
    const result = await deleteJobRole({ id: jr.id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Trade deleted");
      startTransition(() => router.refresh());
    }
  }

  const JobRoleForm = ({ onSubmit }: { onSubmit: (e: React.FormEvent) => Promise<void> }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="jr-name">Trade name</Label>
        <Input
          id="jr-name"
          placeholder="e.g. Electrician"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jr-rate">Default hourly rate</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="jr-rate"
            type="number"
            min="0"
            step="0.01"
            placeholder="25.00"
            required
            className="pl-6"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save trade"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Trades</CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              New trade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New trade</DialogTitle>
            </DialogHeader>
            <JobRoleForm onSubmit={handleCreate} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Default Rate</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRoles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No trades defined yet. Create one to assign to team members.
                </TableCell>
              </TableRow>
            )}
            {initialRoles.map((jr) => (
              <TableRow key={jr.id}>
                <TableCell className="font-medium">{jr.name}</TableCell>
                <TableCell className="text-sm">{centsToDisplay(jr.defaultRegularRateCents)}/hr</TableCell>
                <TableCell className="text-sm text-muted-foreground">{jr._count.memberships}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Dialog
                      open={editTarget?.id === jr.id}
                      onOpenChange={(o) => !o && setEditTarget(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(jr)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit trade</DialogTitle>
                        </DialogHeader>
                        <JobRoleForm onSubmit={handleEdit} />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(jr)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
