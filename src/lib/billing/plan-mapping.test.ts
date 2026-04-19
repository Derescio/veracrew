import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanKey } from "@/generated/prisma/client";

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_PRICE_ID_GROWTH: "price_test_growth",
    STRIPE_LIVE_PRICE_GROWTH: "price_live_growth",
    STRIPE_MODE: "test",
  },
}));

describe("resolvePlanKey (test mode)", () => {
  let resolvePlanKey: (priceId: string) => PlanKey;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_PRICE_ID_GROWTH: "price_test_growth",
        STRIPE_LIVE_PRICE_GROWTH: "price_live_growth",
        STRIPE_MODE: "test",
      },
    }));
    const mod = await import("@/lib/billing/plan-mapping");
    resolvePlanKey = mod.resolvePlanKey;
  });

  it("returns GROWTH for the test-mode growth price ID", () => {
    expect(resolvePlanKey("price_test_growth")).toBe(PlanKey.GROWTH);
  });

  it("throws for an unknown price ID in test mode", () => {
    expect(() => resolvePlanKey("price_unknown_xyz")).toThrow(
      /Unknown Stripe priceId/
    );
  });

  it("error message includes the unknown priceId", () => {
    expect(() => resolvePlanKey("price_bad_123")).toThrow("price_bad_123");
  });

  it("does not silently fall back to STARTER for unknown priceId", () => {
    expect(() => resolvePlanKey("price_unknown_xyz")).toThrow();
  });
});

describe("resolvePlanKey (live mode)", () => {
  let resolvePlanKey: (priceId: string) => PlanKey;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_PRICE_ID_GROWTH: "price_test_growth",
        STRIPE_LIVE_PRICE_GROWTH: "price_live_growth",
        STRIPE_MODE: "live",
      },
    }));
    const mod = await import("@/lib/billing/plan-mapping");
    resolvePlanKey = mod.resolvePlanKey;
  });

  it("returns GROWTH for the live-mode growth price ID", () => {
    expect(resolvePlanKey("price_live_growth")).toBe(PlanKey.GROWTH);
  });

  it("throws for a test price ID when STRIPE_MODE is live", () => {
    expect(() => resolvePlanKey("price_test_growth")).toThrow(
      /Unknown Stripe priceId/
    );
  });
});
