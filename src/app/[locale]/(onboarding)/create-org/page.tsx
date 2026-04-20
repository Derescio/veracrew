"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { createOrganization } from "@/actions/org/create-org";

const COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
] as const;

const CURRENCIES = [
  { code: "CAD", name: "CAD — Canadian Dollar" },
  { code: "USD", name: "USD — US Dollar" },
  { code: "GBP", name: "GBP — British Pound" },
  { code: "AUD", name: "AUD — Australian Dollar" },
] as const;

function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default function CreateOrgPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [name, setName] = useState("");
  const [country, setCountry] = useState("CA");
  const [timezone] = useState(detectTimezone);
  const [currency, setCurrency] = useState("CAD");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "fr">(locale === "fr" ? "fr" : "en");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result = await createOrganization({
        name,
        country,
        timezone,
        currency,
        defaultLocale,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push(`/${locale}/onboarding`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex items-center gap-2 self-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">Veracrew</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your organization</CardTitle>
          <CardDescription>
            Set up your workspace. You can change these settings later.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                placeholder="Acme Construction Co."
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone (auto-detected)</Label>
              <Input value={timezone} readOnly className="bg-muted text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label>Default language</Label>
              <Select
                value={defaultLocale}
                onValueChange={(v) => setDefaultLocale(v as "en" | "fr")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
              A 14-day free trial starts immediately — no credit card required.
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
