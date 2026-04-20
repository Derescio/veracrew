"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2 } from "lucide-react";
import { seedStarterPack, STARTER_PACKS, type StarterPackKey } from "@/actions/documents/seed-starter-pack";
import { cn } from "@/lib/utils";

interface StepStarterPackProps {
  locale: string;
  onNext: () => void;
  onSkip: () => void;
}

export function StepStarterPack({ onNext, onSkip }: StepStarterPackProps) {
  const [selected, setSelected] = useState<StarterPackKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const packs = Object.values(STARTER_PACKS);

  async function handleApply() {
    if (!selected) return;
    setError(null);
    setIsPending(true);

    try {
      const result = await seedStarterPack({ packKey: selected });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onNext();
    } catch {
      setError("Failed to apply starter pack. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <FileText className="size-5 text-primary" />
        </div>
        <CardTitle>Set up document templates</CardTitle>
        <CardDescription>
          Choose a starter pack to auto-create required document templates, or skip to set them up
          manually later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {packs.map((pack) => (
            <button
              key={pack.key}
              type="button"
              onClick={() => setSelected(pack.key as StarterPackKey)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                selected === pack.key && "border-primary bg-primary/5"
              )}
            >
              <CheckCircle2
                className={cn(
                  "mt-0.5 size-5 shrink-0 transition-colors",
                  selected === pack.key ? "text-primary" : "text-muted-foreground/30"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{pack.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{pack.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {pack.templates.slice(0, 3).map((t) => (
                    <Badge key={t.name} variant="secondary" className="text-xs">
                      {t.name}
                    </Badge>
                  ))}
                  {pack.templates.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{pack.templates.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!selected || isPending}
            onClick={handleApply}
          >
            {isPending ? "Applying…" : "Apply starter pack"}
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
