"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { StepLocation } from "./_components/StepLocation";
import { StepStarterPack } from "./_components/StepStarterPack";
import { StepInviteTeam } from "./_components/StepInviteTeam";

type Step = "location" | "starter-pack" | "invite";

const STEPS: Step[] = ["location", "starter-pack", "invite"];

const STEP_LABELS: Record<Step, string> = {
  "location": "Add a location",
  "starter-pack": "Set up documents",
  "invite": "Invite your team",
};

export default function OnboardingPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [currentStep, setCurrentStep] = useState<Step>("location");

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex) / STEPS.length) * 100;

  function nextStep() {
    const next = STEPS[stepIndex + 1];
    if (next) {
      setCurrentStep(next);
    } else {
      router.push(`/${locale}/dashboard`);
    }
  }

  function skip() {
    nextStep();
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-2 self-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">Veracrew</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{STEP_LABELS[currentStep]}</span>
          <span className="text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {currentStep === "location" && (
        <StepLocation locale={locale} onNext={nextStep} onSkip={skip} />
      )}
      {currentStep === "starter-pack" && (
        <StepStarterPack locale={locale} onNext={nextStep} onSkip={skip} />
      )}
      {currentStep === "invite" && (
        <StepInviteTeam locale={locale} onNext={nextStep} onSkip={skip} />
      )}

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => router.push(`/${locale}/dashboard`)}
        >
          Skip setup — go to dashboard
        </Button>
      </div>
    </div>
  );
}
