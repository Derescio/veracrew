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

vi.mock("@/lib/storage/r2", () => ({ r2: {} }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userDocument: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

import { requireOrgContext } from "@/lib/auth/context";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/db/prisma";
import { getPresignedDownloadUrl } from "./download";
import type { OrgContext } from "@/lib/auth/types";

const mockCtx: OrgContext = {
  userId: "user-1",
  organizationId: "org-1",
  role: "OWNER",
  membershipId: "mem-1",
  userEmail: "owner@example.com",
  orgName: "Acme Corp",
};

describe("getPresignedDownloadUrl", () => {
  beforeEach(() => {
    vi.mocked(requireOrgContext).mockResolvedValue(mockCtx);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(getSignedUrl).mockResolvedValue("https://r2.example.com/download");
    vi.mocked(prisma.userDocument.findUnique).mockResolvedValue({
      organizationId: "org-1",
      fileUrl: "org_org-1/docs/doc-1/contract.pdf",
    } as never);
  });

  it("returns a presigned download URL for an owned document", async () => {
    const result = await getPresignedDownloadUrl("doc-1");
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.url).toBe("https://r2.example.com/download");
    }
  });

  it("returns error when document is not found", async () => {
    vi.mocked(prisma.userDocument.findUnique).mockResolvedValue(null);
    const result = await getPresignedDownloadUrl("missing-doc");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/not found/i);
    }
  });

  it("returns error when document belongs to a different org", async () => {
    vi.mocked(prisma.userDocument.findUnique).mockResolvedValue({
      organizationId: "other-org",
      fileUrl: "org_other-org/docs/doc-1/file.pdf",
    } as never);
    const result = await getPresignedDownloadUrl("doc-1");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/access/i);
    }
  });

  it("returns error when object key does not start with org prefix", async () => {
    vi.mocked(prisma.userDocument.findUnique).mockResolvedValue({
      organizationId: "org-1",
      fileUrl: "malicious-prefix/contract.pdf",
    } as never);
    const result = await getPresignedDownloadUrl("doc-1");
    expect("error" in result).toBe(true);
  });

  it("returns rate limit error when limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 10 });
    const result = await getPresignedDownloadUrl("doc-1");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Rate limit/);
    }
  });
});
