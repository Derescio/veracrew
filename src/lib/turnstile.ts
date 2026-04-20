import { env } from "@/lib/env";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * Forwards the client IP for enhanced bot detection accuracy.
 *
 * @throws Error if the secret key is not configured
 */
export async function verifyTurnstile(
  token: string,
  clientIp?: string
): Promise<{ success: boolean; errorCodes?: string[] }> {
  // Fix #9: use validated env singleton (has schema default for CI; throws at boot if absent in prod)
  const secretKey = env.TURNSTILE_SECRET_KEY;

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (clientIp) {
    body.set("remoteip", clientIp);
  }

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = (await res.json()) as TurnstileVerifyResponse;
  return {
    success: data.success,
    errorCodes: data["error-codes"],
  };
}
