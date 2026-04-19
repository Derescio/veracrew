import { describe, it, expect } from "vitest";
import { requires2FASetup } from "./enforce-2fa";
import type { OrgContext } from "./types";

function makeCtx(role: OrgContext["role"]): OrgContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    role,
    membershipId: "mem-1",
  };
}

describe("requires2FASetup", () => {
  it("returns true for OWNER without 2FA", () => {
    expect(requires2FASetup(makeCtx("OWNER"), false)).toBe(true);
  });

  it("returns true for ADMIN without 2FA", () => {
    expect(requires2FASetup(makeCtx("ADMIN"), false)).toBe(true);
  });

  it("returns false for OWNER with 2FA already enabled", () => {
    expect(requires2FASetup(makeCtx("OWNER"), true)).toBe(false);
  });

  it("returns false for ADMIN with 2FA already enabled", () => {
    expect(requires2FASetup(makeCtx("ADMIN"), true)).toBe(false);
  });

  it("returns false for MANAGER without 2FA (not required)", () => {
    expect(requires2FASetup(makeCtx("MANAGER"), false)).toBe(false);
  });

  it("returns false for WORKER without 2FA (not required)", () => {
    expect(requires2FASetup(makeCtx("WORKER"), false)).toBe(false);
  });
});
