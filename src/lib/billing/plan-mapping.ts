import { PlanKey } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Maps Stripe price IDs to internal PlanKey enum values.
 * Throws on unknown priceId — never silently falls back to STARTER.
 */

const TEST_PRICE_MAP: Record<string, PlanKey> = {
  [env.STRIPE_PRICE_ID_GROWTH]: PlanKey.GROWTH,
};

function buildLiveMap(): Record<string, PlanKey> {
  if (!env.STRIPE_LIVE_PRICE_GROWTH) return {};
  return {
    [env.STRIPE_LIVE_PRICE_GROWTH]: PlanKey.GROWTH,
  };
}

export function resolvePlanKey(priceId: string): PlanKey {
  const isLive = env.STRIPE_MODE === "live";
  const map = isLive ? buildLiveMap() : TEST_PRICE_MAP;
  const key = map[priceId];

  if (!key) {
    throw new Error(
      `Unknown Stripe priceId "${priceId}" — cannot resolve to a PlanKey. ` +
        `Check STRIPE_PRICE_ID_GROWTH / STRIPE_LIVE_PRICE_GROWTH env vars.`
    );
  }

  return key;
}
