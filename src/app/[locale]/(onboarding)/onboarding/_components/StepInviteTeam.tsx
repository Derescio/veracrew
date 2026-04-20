"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Trash2 } from "lucide-react";
import { inviteWorker, inviteAdminOrManager } from "@/actions/team/invite";
import type { Role } from "@/generated/prisma/client";

interface InviteRow {
  email: string;
  role: Role;
}

interface StepInviteTeamProps {
  locale: string;
  onNext: () => void;
  onSkip: () => void;
}

export function StepInviteTeam({ onNext, onSkip }: StepInviteTeamProps) {
  const [rows, setRows] = useState<InviteRow[]>([{ email: "", role: "WORKER" }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function addRow() {
    setRows((prev) => [...prev, { email: "", role: "WORKER" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, patch: Partial<InviteRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSend() {
    const toSend = rows.filter((r) => r.email.trim());
    if (toSend.length === 0) {
      onNext();
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const results = await Promise.allSettled(
        toSend.map((r) => {
          if (r.role === "WORKER") {
            return inviteWorker({ email: r.email });
          }
          return inviteAdminOrManager({ email: r.email, role: r.role });
        })
      );

      const failed = results
        .map((r, i) => (r.status === "rejected" || ("error" in (r.value ?? {})) ? toSend[i]?.email : null))
        .filter(Boolean);

      if (failed.length > 0) {
        setError(`Failed to invite: ${failed.join(", ")}. Others were sent successfully.`);
      }

      onNext();
    } catch {
      setError("Failed to send invites. Please try again from the Team page.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Users className="size-5 text-primary" />
        </div>
        <CardTitle>Invite your team</CardTitle>
        <CardDescription>
          Send email invitations to your crew. You can invite more people from the Team page later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="sr-only">Email</Label>
                <Input
                  type="email"
                  placeholder="worker@example.com"
                  value={row.email}
                  onChange={(e) => updateRow(i, { email: e.target.value })}
                />
              </div>
              <div className="w-32">
                <Select
                  value={row.role}
                  onValueChange={(v) => updateRow(i, { role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORKER">Worker</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeRow(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addRow}
        >
          <Plus className="mr-2 size-4" />
          Add another
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button className="flex-1" disabled={isPending} onClick={handleSend}>
            {isPending ? "Sending…" : "Send invites"}
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
