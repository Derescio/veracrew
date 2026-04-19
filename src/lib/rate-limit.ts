import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    });
  }
  return _redis;
}

function slidingWindow(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  });
}

/**
 * Named rate limiters — each keyed by a unique identifier (userId, IP, etc.).
 * Lazily instantiated so the Redis connection is only created when needed.
 */
export const rateLimiters = {
  signIn: slidingWindow(10, "15 m"),
  signUp: slidingWindow(5, "1 h"),
  inviteSend: slidingWindow(20, "1 h"),
  clockIn: slidingWindow(30, "1 m"),
  uploadUrl: slidingWindow(30, "1 m"),
  downloadUrl: slidingWindow(60, "1 m"),
} as const;

export type RateLimiterName = keyof typeof rateLimiters;

/**
 * Checks the rate limit for a given limiter and identifier.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfter: number }`.
 */
export async function checkRateLimit(
  name: RateLimiterName,
  identifier: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const result = await rateLimiters[name].limit(identifier);
  if (result.success) {
    return { allowed: true };
  }
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
  return { allowed: false, retryAfter };
}
