"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Building2 } from "lucide-react";
import { acceptInvite } from "@/actions/auth/accept-invite";
import type { Role } from "@/generated/prisma/client";

interface InviteAcceptFormProps {
  locale: string;
  token: string;
  email: string;
  role: Role;
  orgName: string;
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  WORKER: "Worker",
};

export function InviteAcceptForm({ locale, token, email, role, orgName }: InviteAcceptFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const result = await acceptInvite({ token, name, password });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center gap-2 self-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">Veracrew</span>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">You&apos;re invited!</CardTitle>
          <CardDescription>
            Join <strong>{orgName}</strong> as a{" "}
            <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Joining as <strong className="text-foreground">{email}</strong>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create a password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-center">
              <TurnstileWidget
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !turnstileToken}
            >
              {isPending ? "Joining…" : "Join organization"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={`/${locale}/auth/sign-in`}
              className="font-medium underline-offset-4 hover:underline"
            >
              Sign in instead
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
