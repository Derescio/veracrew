// Fix #17: aligned feature flag names and plan shapes with the Phase 0-03 spec
import { PlanKey } from "@/generated/prisma/client";
import { PlanLimitError } from "@/lib/errors";

export type FeatureFlag =
  | "fullScheduler"
  | "jobRequiredDocs"
  | "perJobRoleRates"
  | "dailyAndWeeklyOT"
  | "groupMessaging"
  | "webPush"
  | "auditExport"
  | "jsonExport"
  | "apiAccess"
  | "sso"
  | "multiOrgAdmin"
  | "customStarterPacks"
  | "messageRetentionConfig";

export interface PlanLimits {
  maxWorkers: number | null;
  maxLocations: number | null;
  maxInvoicesPerMonth: number | null;
  maxStarterPacks: number | null;
  features: Set<FeatureFlag>;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  [PlanKey.STARTER]: {
    maxWorkers: 5,
    maxLocations: 1,
    maxInvoicesPerMonth: 5,
    maxStarterPacks: 1,
    features: new Set(["webPush"]),
  },
  [PlanKey.GROWTH]: {
    maxWorkers: 50,
    maxLocations: 5,
    maxInvoicesPerMonth: null,
    maxStarterPacks: null,
    features: new Set([
      "fullScheduler", "jobRequiredDocs", "perJobRoleRates",
      "dailyAndWeeklyOT", "groupMessaging", "webPush",
      "auditExport", "jsonExport",
    ]),
  },
  [PlanKey.SCALE]: {
    maxWorkers: null,
    maxLocations: null,
    maxInvoicesPerMonth: null,
    maxStarterPacks: null,
    features: new Set([
      "fullScheduler", "jobRequiredDocs", "perJobRoleRates",
      "dailyAndWeeklyOT", "groupMessaging", "webPush",
      "auditExport", "jsonExport", "apiAccess", "sso",
      "multiOrgAdmin", "customStarterPacks", "messageRetentionConfig",
    ]),
  },
};

/**
 * No-op guard — placeholder for feature gate enforcement.
 * Will be wired to live plan checks in Phase 8.
 */
export function requireFeature(_flag: FeatureFlag): void {
  // Phase 8: check PLAN_LIMITS[ctx.planKey].features.has(_flag); throw PlanLimitError if absent
  void PlanLimitError; // keep import live for future use
}

/**
 * No-op guard — placeholder for seat/resource limit enforcement.
 * Will be wired to live plan checks in Phase 8.
 */
export function requireWithinLimit(
  _resource: "workers" | "locations" | "invoices",
): void {
  // Phase 8: check PLAN_LIMITS[ctx.planKey][limitKey] against current count; throw PlanLimitError
}
