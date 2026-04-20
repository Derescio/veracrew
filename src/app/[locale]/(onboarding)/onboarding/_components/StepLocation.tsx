"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import { createLocation } from "@/actions/locations/create-location";

interface StepLocationProps {
  locale: string;
  onNext: () => void;
  onSkip: () => void;
}

export function StepLocation({ onNext, onSkip }: StepLocationProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      // Use a simple geocode approximation (0,0) for now — proper geocoding in Phase 3
      const result = await createLocation({
        name,
        address,
        lat: 0,
        lng: 0,
        radiusMeters,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      onNext();
    } catch {
      setError("Failed to create location. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="size-5 text-primary" />
        </div>
        <CardTitle>Add your first work site</CardTitle>
        <CardDescription>
          Workers will clock in and out at this location. You can add more later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">Site name</Label>
            <Input
              id="site-name"
              placeholder="Downtown Office"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main St, Toronto, ON"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="radius">
              Geofence radius: <strong>{radiusMeters}m</strong>
            </Label>
            <input
              id="radius"
              type="range"
              min={25}
              max={500}
              step={25}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>25m</span>
              <span>500m</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? "Adding…" : "Add location"}
            </Button>
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
