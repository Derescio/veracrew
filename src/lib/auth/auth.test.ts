import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole, assertOrgMembership, requireOrgContext } from "./context";
import { UnauthorizedError, ForbiddenError, NoActiveOrgError } from "@/lib/errors";
import type { OrgContext } from "./types";

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

function makeCtx(role: OrgContext["role"] = "OWNER"): OrgContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    role,
    membershipId: "mem-1",
  };
}

describe("requireRole", () => {
  it("passes when role meets the minimum", () => {
    expect(() => requireRole("MANAGER", makeCtx("ADMIN"))).not.toThrow();
    expect(() => requireRole("OWNER", makeCtx("OWNER"))).not.toThrow();
    expect(() => requireRole("WORKER", makeCtx("WORKER"))).not.toThrow();
  });

  it("throws ForbiddenError when role is below minimum", () => {
    expect(() => requireRole("ADMIN", makeCtx("MANAGER"))).toThrow(ForbiddenError);
    expect(() => requireRole("OWNER", makeCtx("ADMIN"))).toThrow(ForbiddenError);
    expect(() => requireRole("MANAGER", makeCtx("WORKER"))).toThrow(ForbiddenError);
  });
});

describe("assertOrgMembership", () => {
  let mockMembershipFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    mockMembershipFindUnique = prisma.membership.findUnique as ReturnType<typeof vi.fn>;
    mockMembershipFindUnique.mockReset();
  });

  it("resolves when user is an active member", async () => {
    mockMembershipFindUnique.mockResolvedValue({ status: "ACTIVE" });
    await expect(assertOrgMembership("user-1", "org-1")).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when membership is not found", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);
    await expect(assertOrgMembership("user-1", "org-1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when membership status is SUSPENDED", async () => {
    mockMembershipFindUnique.mockResolvedValue({ status: "SUSPENDED" });
    await expect(assertOrgMembership("user-1", "org-1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("requireOrgContext", () => {
  let mockAuth: ReturnType<typeof vi.fn>;
  let mockMembershipFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const authModule = await import("@/lib/auth/auth");
    mockAuth = authModule.auth as ReturnType<typeof vi.fn>;
    mockAuth.mockReset();

    const { prisma } = await import("@/lib/db/prisma");
    mockMembershipFindUnique = prisma.membership.findUnique as ReturnType<typeof vi.fn>;
    mockMembershipFindUnique.mockReset();
  });

  it("throws UnauthorizedError when no session exists", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireOrgContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {}, organizationId: "org-1" });
    await expect(requireOrgContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws NoActiveOrgError when session has no organizationId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireOrgContext()).rejects.toBeInstanceOf(NoActiveOrgError);
  });

  it("throws ForbiddenError when membership is suspended", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" }, organizationId: "org-1" });
    mockMembershipFindUnique.mockResolvedValue({ id: "mem-1", role: "OWNER", jobRoleId: null, status: "SUSPENDED" });
    await expect(requireOrgContext()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns OrgContext for a valid active session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "owner@example.com" }, organizationId: "org-1" });
    mockMembershipFindUnique.mockResolvedValue({
      id: "mem-1",
      role: "OWNER",
      jobRoleId: null,
      status: "ACTIVE",
      organization: { name: "Acme Corp" },
    });

    const ctx = await requireOrgContext();
    expect(ctx).toEqual({
      userId: "user-1",
      organizationId: "org-1",
      role: "OWNER",
      membershipId: "mem-1",
      userEmail: "owner@example.com",
      orgName: "Acme Corp",
    });
  });
});
