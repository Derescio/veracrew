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
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured");
  }

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
