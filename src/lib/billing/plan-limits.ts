import { PlanKey } from "@/generated/prisma/client";
import { PlanLimitError } from "@/lib/errors";

export type FeatureFlag =
  | "advanced_reporting"
  | "api_access"
  | "custom_roles"
  | "priority_support";

export interface PlanLimits {
  maxSeats: number;
  maxLocations: number;
  features: FeatureFlag[];
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  [PlanKey.STARTER]: {
    maxSeats: 10,
    maxLocations: 1,
    features: [],
  },
  [PlanKey.GROWTH]: {
    maxSeats: 100,
    maxLocations: 10,
    features: ["advanced_reporting", "api_access"],
  },
  [PlanKey.SCALE]: {
    maxSeats: Infinity,
    maxLocations: Infinity,
    features: ["advanced_reporting", "api_access", "custom_roles", "priority_support"],
  },
};

/**
 * No-op guard — placeholder for feature gate enforcement.
 * Will be wired to live plan checks in Phase 8.
 */
export function requireFeature(
  _planKey: PlanKey,
  _feature: FeatureFlag
): void {
  // Phase 8: check PLAN_LIMITS[planKey].features.includes(feature)
  // throw new PlanLimitError(`Feature "${feature}" is not available on your plan.`);
  void PlanLimitError; // keep import live for future use
}

/**
 * No-op guard — placeholder for seat/resource limit enforcement.
 * Will be wired to live plan checks in Phase 8.
 */
export function requireWithinLimit(
  _planKey: PlanKey,
  _limitKey: keyof Pick<PlanLimits, "maxSeats" | "maxLocations">,
  _currentCount: number
): void {
  // Phase 8: if currentCount >= PLAN_LIMITS[planKey][limitKey]) throw PlanLimitError
}
