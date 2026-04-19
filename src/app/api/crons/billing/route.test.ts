import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "a-very-long-and-secure-cron-secret-value",
  },
}));

vi.mock("@/jobs/billing-crons", () => ({
  checkTrialExpiry: vi.fn().mockResolvedValue(undefined),
  checkPastDueExpiry: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/crons/billing/route";
import { checkTrialExpiry, checkPastDueExpiry } from "@/jobs/billing-crons";

const VALID_SECRET = "a-very-long-and-secure-cron-secret-value";

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["x-cron-secret"] = secret;
  }
  return new NextRequest("http://localhost/api/crons/billing", { headers });
}

describe("GET /api/crons/billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no x-cron-secret header is present", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-cron-secret is incorrect", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and calls both cron functions with valid secret", async () => {
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    expect(checkTrialExpiry).toHaveBeenCalledOnce();
    expect(checkPastDueExpiry).toHaveBeenCalledOnce();
  });

  it("returns 500 when a cron function throws", async () => {
    vi.mocked(checkTrialExpiry).mockRejectedValueOnce(new Error("DB failed"));
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });
});
