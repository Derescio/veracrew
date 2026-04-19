import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "./turnstile";

const VALID_TOKEN = "test-token";
const CLIENT_IP = "1.2.3.4";

describe("verifyTurnstile", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TURNSTILE_SECRET_KEY: "secret-key-test" };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("returns success: true when Cloudflare responds with success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstile(VALID_TOKEN, CLIENT_IP);
    expect(result.success).toBe(true);
  });

  it("returns success: false and errorCodes when verification fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    } as Response);

    const result = await verifyTurnstile(VALID_TOKEN);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });

  it("throws when TURNSTILE_SECRET_KEY is not set", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyTurnstile(VALID_TOKEN)).rejects.toThrow(
      "TURNSTILE_SECRET_KEY is not configured"
    );
  });

  it("forwards clientIp in the request body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    await verifyTurnstile(VALID_TOKEN, CLIENT_IP);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.body?.toString()).toContain(`remoteip=${CLIENT_IP}`);
  });
});
