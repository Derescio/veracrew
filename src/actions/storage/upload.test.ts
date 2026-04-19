import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/context", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/storage/r2", () => ({
  r2: {},
  BUCKETS: { docs: "veracrew-docs", images: "veracrew-images" },
}));

vi.mock("@/lib/env", () => ({
  env: { R2_PUBLIC_URL: null },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userDocument: { create: vi.fn() },
    r2DeletionJob: { create: vi.fn() },
  },
}));

import { requireOrgContext } from "@/lib/auth/context";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPresignedUploadUrl } from "./upload";
import type { OrgContext } from "@/lib/auth/types";

const mockCtx: OrgContext = {
  userId: "user-1",
  organizationId: "org-1",
  role: "OWNER",
  membershipId: "mem-1",
  userEmail: "owner@example.com",
  orgName: "Acme Corp",
};

describe("getPresignedUploadUrl", () => {
  beforeEach(() => {
    vi.mocked(requireOrgContext).mockResolvedValue(mockCtx);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(getSignedUrl).mockResolvedValue("https://r2.example.com/presigned");
  });

  it("returns presigned URL data for a valid PDF upload", async () => {
    const result = await getPresignedUploadUrl("contract.pdf", "application/pdf", 1024);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.presignedUrl).toBe("https://r2.example.com/presigned");
      expect(result.data.objectKey).toMatch(/^org_org-1\/docs\//);
      expect(result.data.bucket).toBe("veracrew-docs");
    }
  });

  it("rejects blocked extensions", async () => {
    const result = await getPresignedUploadUrl("virus.exe", "application/octet-stream", 1024);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/\.exe/);
    }
  });

  it("rejects files exceeding the 50 MB cap", async () => {
    const overLimit = 51 * 1024 * 1024;
    const result = await getPresignedUploadUrl("bigfile.pdf", "application/pdf", overLimit);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/50 MB/);
    }
  });

  it("returns rate limit error when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 30 });
    const result = await getPresignedUploadUrl("file.pdf", "application/pdf", 1024);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Rate limit/);
    }
  });

  it("object key starts with org prefix", async () => {
    const result = await getPresignedUploadUrl("doc.pdf", "application/pdf", 2048);
    if ("data" in result) {
      expect(result.data.objectKey.startsWith(`org_${mockCtx.organizationId}/`)).toBe(true);
    }
  });
});
