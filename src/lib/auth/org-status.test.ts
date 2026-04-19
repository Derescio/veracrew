import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireOrgActive } from "./org-status";
import { OrgInactiveError } from "@/lib/errors";
import type { OrgContext } from "./types";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

const ctx: OrgContext = {
  userId: "user-1",
  organizationId: "org-1",
  role: "OWNER",
  membershipId: "mem-1",
};

describe("requireOrgActive", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    mockFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>;
    mockFindUnique.mockReset();
  });

  it.each(["TRIALING", "ACTIVE", "PAST_DUE"] as const)(
    "resolves for status %s",
    async (status) => {
      mockFindUnique.mockResolvedValue({ status, deletedAt: null });
      await expect(requireOrgActive(ctx)).resolves.toBeUndefined();
    }
  );

  it.each(["TRIAL_EXPIRED", "CANCELLED", "SUSPENDED"] as const)(
    "throws OrgInactiveError for status %s",
    async (status) => {
      mockFindUnique.mockResolvedValue({ status, deletedAt: null });
      await expect(requireOrgActive(ctx)).rejects.toBeInstanceOf(OrgInactiveError);
    }
  );

  it("throws OrgInactiveError when org is soft-deleted", async () => {
    mockFindUnique.mockResolvedValue({ status: "ACTIVE", deletedAt: new Date() });
    await expect(requireOrgActive(ctx)).rejects.toBeInstanceOf(OrgInactiveError);
  });

  it("throws OrgInactiveError when org is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(requireOrgActive(ctx)).rejects.toBeInstanceOf(OrgInactiveError);
  });
});
